// =====================================================================
// === SCREENS: PEDIDO — SUGESTAO DE NUMERO ============================
// Dono UNICO do contrato "qual e o proximo numero de Pedido" no cliente.
//
// Fase: KLEBER-APP-OPERATIONAL-STABILIZATION — pre-preenchimento do
//   numero do Pedido na tela admin de criacao.
//
// POR QUE ESTE MODULO EXISTE
//   A regra de numeracao tem tres partes que sempre andam juntas e que
//   nao podem ficar espalhadas por tela: de onde vem o candidato, como
//   se reconhece um numero ja ocupado, e o que se diz ao operador em
//   cada caso. Concentra-las aqui evita que uma segunda superficie
//   reinvente uma delas de outro jeito — em especial reinventando o
//   proibido MAX(numero)+1 (CODE_HEALTH_RULES.md sec.8).
//
// O QUE ESTE MODULO NAO FAZ
//   - nao renderiza nada;
//   - nao escreve em `pedidos`;
//   - nao reserva numero algum. O valor devolvido e um CANDIDATO ADVISORY:
//     a autoridade final e UNIQUE(pedidos.numero) no banco.
//
// Carregar via <script src="js/screens/pedido-numero-sugestao.js?v=...">
// no <head>, ANTES de js/screens/pedido-form.js.
// =====================================================================

(function (window) {
  'use strict';

  // Nome da RPC admin-only de db/90. Ela le o ESTADO da sequencia de
  // identidade (`public.pedidos_numero_seq`) sem chamar nextval, entao
  // consultar NAO consome nem avanca numero: abrir a tela e de graca.
  var RPC_PROXIMO_NUMERO = 'consultar_proximo_numero_pedido';

  var MSG_EM_USO = 'Este número de pedido já está em uso.';
  var MSG_AJUDA_SUGESTAO = 'Sugestão automática. Você pode alterar antes de salvar.';
  var MSG_SEM_SUGESTAO = 'Sugestão indisponível. Deixe em branco para numeração automática ou informe um número.';

  // Le o proximo numero automatico a partir da AUTORIDADE. MAX(numero)+1 e
  // proibido: um numero manual alto ja avancou a sequencia, uma validacao
  // revertida ja consumiu valores, e as lacunas sao aceitas por projeto
  // (db/89) — nos tres casos MAX+1 devolveria um numero que o banco NAO
  // usaria. Devolve `null` (nunca lanca) quando a sugestao nao esta
  // disponivel: sem permissao, offline, ou db/90 ainda nao aplicado.
  async function consultarProximoNumero(supa) {
    if (!supa || typeof supa.rpc !== 'function') return null;
    try {
      var res = await supa.rpc(RPC_PROXIMO_NUMERO);
      if (!res || res.error) {
        console.error('pedido-numero: sugestao indisponivel', res && res.error);
        return null;
      }
      var candidato = Number(res.data);
      if (!Number.isInteger(candidato) || candidato <= 0) {
        console.error('pedido-numero: sugestao invalida', res.data);
        return null;
      }
      return candidato;
    } catch (e) {
      console.error('pedido-numero: sugestao indisponivel', e);
      return null;
    }
  }

  // Um numero ocupado chega como violacao de unicidade (23505) da constraint
  // pedidos_numero_key. Detectar deterministicamente evita confundir esse
  // caso com qualquer outra falha de insercao.
  function isNumeroDuplicado(error) {
    if (!error) return false;
    if (String(error.code) === '23505') return true;
    var texto = String(error.message || '') + ' ' + String(error.details || '');
    return /pedidos_numero_key/i.test(texto);
  }

  // Um valor digitado so e aceitavel se for inteiro positivo. Em branco e
  // valido e significa "deixe a coluna de identidade alocar".
  function normalizarNumeroDigitado(valor) {
    var texto = String(valor == null ? '' : valor).trim();
    if (texto === '') return { vazio: true, valido: true, numero: null };
    var numero = Number(texto);
    if (!Number.isInteger(numero) || numero <= 0) {
      return { vazio: false, valido: false, numero: null };
    }
    return { vazio: false, valido: true, numero: numero };
  }

  // Conflito CONTROLADO: a sugestao foi tomada por outro Pedido entre a
  // abertura da tela e o envio. O operador precisa saber QUE numero se
  // perdeu e QUAL entrou no lugar — trocar em silencio e proibido.
  function mensagemSugestaoRenovada(anterior, nova) {
    if (nova == null || String(nova) === '') {
      return 'O número ' + anterior + ' acabou de ser usado por outro pedido. '
        + 'Informe um número disponível.';
    }
    return 'O número ' + anterior + ' acabou de ser usado por outro pedido. '
      + 'Nova sugestão: ' + nova + '.';
  }

  window.RAVATEX_PEDIDO_NUMERO = {
    RPC_PROXIMO_NUMERO: RPC_PROXIMO_NUMERO,
    MSG_EM_USO: MSG_EM_USO,
    MSG_AJUDA_SUGESTAO: MSG_AJUDA_SUGESTAO,
    MSG_SEM_SUGESTAO: MSG_SEM_SUGESTAO,
    consultarProximoNumero: consultarProximoNumero,
    isNumeroDuplicado: isNumeroDuplicado,
    normalizarNumeroDigitado: normalizarNumeroDigitado,
    mensagemSugestaoRenovada: mensagemSugestaoRenovada
  };
})(window);
