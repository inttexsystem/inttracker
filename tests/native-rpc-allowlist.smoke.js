// tests/native-rpc-allowlist.smoke.js
//
// NATIVE-RECEIPT-COORDINATED-RELEASE-P2-A — separação SEGURA das RPCs do P2
// em js/supabase-client.js.
//
// A regra que este arquivo guarda: das catorze RPCs nativas que o P2 consome,
// SÓ AS QUATRO PROVADAMENTE DE LEITURA entram em `_READ_ONLY_RPCS` — a lista
// cujo ÚNICO efeito é deixar uma chamada CONTORNAR o write-guard que impede
// localhost e os previews da Vercel de gravarem no banco de PRODUÇÃO (não
// existe banco não-produtivo válido). Uma escritora nessa lista abriria um
// caminho real de escrita em produção a partir de um preview.
//
// O inventário declarativo das catorze é METADADO: documenta o que o P2 usa e
// não autoriza nada. Este arquivo prova as duas coisas — que ele existe e que
// o proxy NUNCA o consulta.
//
// Transporte MOCKADO e nomes sintéticos. Nenhuma conexão hospedada, nenhuma
// RPC de mutação real é invocada.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SUPA = path.join(ROOT, 'js', 'supabase-client.js');
const CFG  = path.join(ROOT, 'js', 'config.js');

const supaSrc = fs.readFileSync(SUPA, 'utf8');
const cfgSrc  = fs.readFileSync(CFG, 'utf8');

// As QUATRO leituras nativas provadas (STABLE, corpo e fecho transitivo sem
// mutação) que o P2-A acrescenta à allowlist.
const LEITURAS_NATIVAS_P2 = [
  'oc_disponibilidade_op',            // db/101
  'pedido_elegivel_cancelamento',     // db/105
  'listar_fila_aceite_fornecedor',    // db/103
  'pode_recuperar_op_acabamento',     // db/108
];

// As DEZ escritoras do P2. Nenhuma pode entrar na allowlist, e todas têm de
// morrer ANTES do transporte em ambiente guardado.
const ESCRITORAS_P2 = [
  'salvar_ajuste_producao_op',             // db/102
  'iniciar_producao_op',                   // db/102
  'alterar_status_pedido',                 // db/105
  'cancelar_pedido',                       // db/105
  'aceitar_ordem_compra',                  // db/103
  'rejeitar_ordem_compra',                 // db/103
  'registrar_entrega_cima_com_acabamento', // db/111
  'gerar_op_acabamento',                   // db/108
  'estornar_expedicao_tapete_parcial',     // db/109
  'corrigir_entrega_expedicao',            // db/109
];

// Auxiliares OWNER-ONLY: não são superfície de cliente e não podem aparecer
// nem na allowlist nem no inventário declarativo.
const AUXILIARES_OWNER_ONLY = [
  '_oc_disponibilidade_linhas',
  '_oc_material_recebido_liquido',
  '_oc_reserva_ativa',
  '_op_status_aplicar',
  '_pedido_status_recalcular',
  '_expedicao_estorno_aplicar',
];

function makeFakeSupabaseClient() {
  const calls = [];
  const client = {
    _calls: calls,
    from: (t) => { calls.push({ op: 'from', table: t }); return client; },
    select: () => client,
    rpc: (fn, params) => { calls.push({ op: 'rpc', fn, params }); return Promise.resolve({ data: 'ok', error: null }); },
    auth: { getSession: () => Promise.resolve({ data: { session: null }, error: null }) },
    storage: {},
  };
  return client;
}

function runSandbox({ hostname }) {
  const fakeSupa = makeFakeSupabaseClient();
  const documentMock = {
    body: null,
    createElement: (t) => ({ tagName: t.toUpperCase(), setAttribute() {}, style: {}, textContent: '', prepend() {}, appendChild() {} }),
    getElementById: () => null,
  };
  const sandbox = {
    console, URL, URLSearchParams, setTimeout, clearTimeout,
    location: { hostname, href: 'http://' + hostname + '/index.html' },
    document: documentMock,
    supabase: { createClient: () => fakeSupa },
    Promise, Reflect, Proxy, Set, Object, Array, JSON, Error, String, Number, Boolean,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(cfgSrc, sandbox, { filename: 'js/config.js' });
  vm.runInContext(supaSrc, sandbox, { filename: 'js/supabase-client.js' });
  return { sandbox, fakeSupa };
}

function chamarRpc(sandbox, fn, params) {
  const ctx = vm.runInContext('({ chamar: (f, p) => supa.rpc(f, p) })', sandbox);
  return ctx.chamar(fn, params);
}

function rpcCalls(fakeSupa) {
  return fakeSupa._calls.filter((c) => c.op === 'rpc');
}

// Lê a allowlist do FONTE, como literal estático auditável.
function allowlistDoFonte() {
  const m = supaSrc.match(/_READ_ONLY_RPCS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(m, '_READ_ONLY_RPCS não é um `new Set([...])` literal em js/supabase-client.js');
  return (m[1].match(/'([a-z0-9_]+)'/g) || []).map((s) => s.replace(/'/g, ''));
}

// ---------------------------------------------------------------------
// 1. A allowlist: exatamente 18 nomes distintos e explícitos
// ---------------------------------------------------------------------

test('1. _READ_ONLY_RPCS tem exatamente 18 entradas distintas e nomeadas', () => {
  const lista = allowlistDoFonte();
  assert.equal(lista.length, 18, 'a allowlist literal tem de ter 18 entradas');
  assert.equal(new Set(lista).size, 18, 'as 18 entradas têm de ser distintas');
  assert.ok(lista.every((n) => /^[a-z][a-z0-9_]*$/.test(n)), 'toda entrada é um nome literal explícito');
});

test('2. as QUATRO leituras nativas do P2 entraram', () => {
  const lista = allowlistDoFonte();
  for (const nome of LEITURAS_NATIVAS_P2) {
    assert.ok(lista.includes(nome), nome + ' devia estar na allowlist de leitura');
  }
});

test('3. NENHUMA das dez escritoras do P2 entrou na allowlist', () => {
  const lista = allowlistDoFonte();
  for (const nome of ESCRITORAS_P2) {
    assert.equal(lista.includes(nome), false,
      nome + ' GRAVA: na allowlist ela abriria escrita em produção a partir de um preview');
  }
});

test('4. nenhum auxiliar owner-only entrou na allowlist', () => {
  const lista = allowlistDoFonte();
  for (const nome of AUXILIARES_OWNER_ONLY) {
    assert.equal(lista.includes(nome), false, nome + ' é owner-only e não é superfície de cliente');
  }
});

test('5. a allowlist continua UM literal estático — nada de concat/spread/montagem', () => {
  const m = supaSrc.match(/_READ_ONLY_RPCS\s*=\s*([\s\S]*?)\]\)/);
  assert.ok(m, 'declaração de _READ_ONLY_RPCS não encontrada');
  assert.doesNotMatch(m[1], /\.concat\(|\.\.\.|Object\.keys|\.map\(|\bvar\b|\blet\b/,
    'a allowlist não pode ser montada dinamicamente nem esconder entradas');
  assert.equal((supaSrc.match(/_READ_ONLY_RPCS\s*=\s*new Set/g) || []).length, 1,
    'só pode existir UMA declaração da allowlist');
});

// ---------------------------------------------------------------------
// 2. Comportamento em ambiente GUARDADO (localhost)
// ---------------------------------------------------------------------

test('6. as quatro leituras nativas ALCANÇAM o transporte mockado em ambiente guardado', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true, 'o cenário tem de ser guardado');
  for (const nome of LEITURAS_NATIVAS_P2) {
    fakeSupa._calls.length = 0;
    const res = await chamarRpc(sandbox, nome, { p_op_id: 900001 });
    assert.equal(res && res.error, null, nome + ' não devia ser bloqueada');
    assert.equal(rpcCalls(fakeSupa).length, 1, nome + ' não alcançou o transporte');
    assert.equal(rpcCalls(fakeSupa)[0].fn, nome, 'o nome tem de ser repassado sem alteração');
  }
});

test('7. as DEZ escritoras do P2 morrem ANTES do transporte em ambiente guardado', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  for (const nome of ESCRITORAS_P2) {
    fakeSupa._calls.length = 0;
    await assert.rejects(
      () => chamarRpc(sandbox, nome, { p_op_id: 900001 }),
      /WRITE-GUARD/,
      nome + ' TEM de ser bloqueada em ambiente guardado'
    );
    assert.equal(rpcCalls(fakeSupa).length, 0,
      nome + ' chegou ao transporte — o write-guard falhou e produção ficaria exposta');
  }
});

test('8. um preview *.vercel.app é guardado igual a localhost', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'inttracker-git-dev-x.vercel.app' });
  assert.equal(vm.runInContext('window._GUARD_BLOCK_WRITES', sandbox), true);
  await assert.rejects(() => chamarRpc(sandbox, 'salvar_ajuste_producao_op', {}), /WRITE-GUARD/);
  assert.equal(rpcCalls(fakeSupa).length, 0);
  const res = await chamarRpc(sandbox, 'oc_disponibilidade_op', {});
  assert.equal(res && res.error, null, 'a leitura provada continua funcionando no preview');
});

test('9. o default é NEGAR: nome desconhecido e nome montado dinamicamente caem', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  await assert.rejects(() => chamarRpc(sandbox, 'rpc_que_nao_existe', {}), /WRITE-GUARD/);
  // Um nome montado em tempo de execução não pode virar autorização.
  const montado = 'oc_disponibilidade' + '_op_falso';
  await assert.rejects(() => chamarRpc(sandbox, montado, {}), /WRITE-GUARD/);
  assert.equal(rpcCalls(fakeSupa).length, 0);
});

// ---------------------------------------------------------------------
// 3. O inventário declarativo: metadado, jamais autorização
// ---------------------------------------------------------------------

test('10. o inventário declarativo nomeia as CATORZE RPCs do P2', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const inv = vm.runInContext('window.RAVATEX_SUPABASE_CLIENT.P2_RPC_INVENTORY', sandbox);
  // Array.from: os arrays vêm do realm do sandbox e deepEqual compara também
  // o prototype. A cópia traz os nomes para o realm do teste.
  const leitura = Array.from(inv.leitura);
  const escrita = Array.from(inv.escrita);
  const todas = leitura.concat(escrita);
  assert.equal(todas.length, 14, 'o inventário tem de ter as catorze RPCs do P2');
  assert.equal(new Set(todas).size, 14, 'sem repetição');
  assert.deepEqual(leitura.slice().sort(), LEITURAS_NATIVAS_P2.slice().sort());
  assert.deepEqual(escrita.slice().sort(), ESCRITORAS_P2.slice().sort());
});

test('11. o inventário OMITE os auxiliares owner-only', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const inv = vm.runInContext('window.RAVATEX_SUPABASE_CLIENT.P2_RPC_INVENTORY', sandbox);
  const todas = inv.leitura.concat(inv.escrita);
  for (const nome of AUXILIARES_OWNER_ONLY) {
    assert.equal(todas.includes(nome), false, nome + ' é owner-only e não pertence ao inventário de cliente');
  }
});

test('12. o inventário é CONGELADO', () => {
  const { sandbox } = runSandbox({ hostname: 'localhost' });
  const inv = vm.runInContext('window.RAVATEX_SUPABASE_CLIENT.P2_RPC_INVENTORY', sandbox);
  assert.equal(Object.isFrozen(inv), true, 'o inventário tem de ser congelado');
  assert.equal(Object.isFrozen(inv.leitura), true);
  assert.equal(Object.isFrozen(inv.escrita), true);
});

test('13. o inventário NÃO concede execução: estar nele não libera nada', async () => {
  const { sandbox, fakeSupa } = runSandbox({ hostname: 'localhost' });
  const inv = vm.runInContext('window.RAVATEX_SUPABASE_CLIENT.P2_RPC_INVENTORY', sandbox);
  for (const nome of inv.escrita) {
    fakeSupa._calls.length = 0;
    await assert.rejects(() => chamarRpc(sandbox, nome, {}), /WRITE-GUARD/,
      nome + ' está no inventário e MESMO ASSIM tem de ser bloqueada');
    assert.equal(rpcCalls(fakeSupa).length, 0);
  }
});

test('14. o PROXY nunca consulta o inventário — só a allowlist', () => {
  // O corpo do proxy é o trecho entre `if (prop === 'rpc')` e o fim do get().
  const proxy = (supaSrc.match(/if \(prop === 'rpc'\)[\s\S]*?\n        \}/) || [''])[0];
  assert.ok(proxy, 'o ramo rpc do proxy não foi encontrado');
  assert.match(proxy, /_READ_ONLY_RPCS\.has\(fn\)/,
    'a decisão do proxy tem de ser a allowlist provada');
  assert.doesNotMatch(proxy, /_P2_RPC_INVENTORY|P2_RPC_INVENTORY/,
    'o proxy NÃO pode consultar o inventário declarativo');
});

test('15. o inventário nunca é unido nem passado para a allowlist', () => {
  assert.doesNotMatch(supaSrc, /_READ_ONLY_RPCS[\s\S]{0,120}_P2_RPC_INVENTORY/,
    'o inventário não pode alimentar a allowlist');
  assert.doesNotMatch(supaSrc, /_P2_RPC_INVENTORY[\s\S]{0,120}_READ_ONLY_RPCS\.add/,
    'nada pode acrescentar o inventário à allowlist em tempo de execução');
  assert.doesNotMatch(supaSrc, /_READ_ONLY_RPCS\.add\(/,
    'a allowlist não pode crescer em tempo de execução');
});

test('16. não existe escotilha de fuga para o client BRUTO nas telas', () => {
  // O client bruto continua publicado para diagnóstico, mas nenhuma tela pode
  // usá-lo para contornar o guard.
  const dir = path.join(ROOT, 'js');
  const arquivos = [];
  (function varrer(d) {
    for (const nome of fs.readdirSync(d)) {
      const p = path.join(d, nome);
      if (fs.statSync(p).isDirectory()) varrer(p);
      else if (nome.endsWith('.js') && nome !== 'supabase-client.js') arquivos.push(p);
    }
  })(dir);
  for (const p of arquivos) {
    const src = fs.readFileSync(p, 'utf8');
    assert.doesNotMatch(src, /_supaRaw|RAVATEX_SUPABASE_CLIENT\.raw/,
      path.relative(ROOT, p) + ' usa o client BRUTO e contornaria o write-guard');
  }
});

test('17. nenhum endpoint hospedado é contatado por este arquivo', () => {
  // A prova é estrutural: o sandbox injeta seu próprio createClient e o
  // fakeSupa nunca faz rede. Nenhuma URL real aparece nos testes.
  const meu = fs.readFileSync(__filename, 'utf8');
  assert.doesNotMatch(meu, /https?:\/\/[a-z0-9-]+\.supabase\.co/i,
    'nenhum endpoint Supabase hospedado pode aparecer neste teste');
});
