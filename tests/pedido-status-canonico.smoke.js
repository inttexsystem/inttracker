// tests/pedido-status-canonico.smoke.js
//
// P2-C — transicoes de status e cancelamento do Pedido pelos escritores
// canonicos (db/105, secao 9.9.L). Transporte MOCKADO, ids sinteticos.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const cp     = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const PDE = path.join(ROOT, 'js', 'screens', 'pedido-detail-events.js');
const src = fs.readFileSync(PDE, 'utf8');
const exec = src.split(/\r?\n/).filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');

test('0. sintaxe JS valida', () => { cp.execSync(`node --check "${PDE}"`, { stdio: 'pipe' }); });

test('1. transicoes usam SO alterar_status_pedido', () => {
  assert.match(exec, /rpc\('alterar_status_pedido'/);
});

test('2. cancelamento usa o portao de elegibilidade e o escritor D7', () => {
  assert.match(exec, /rpc\('pedido_elegivel_cancelamento'/);
  assert.match(exec, /rpc\('cancelar_pedido'/);
});

test('3. NENHUM update direto de pedidos.status resta', () => {
  assert.doesNotMatch(exec, /from\(\s*['"]pedidos['"]\s*\)[\s\S]{0,200}update\(\s*\{\s*status:/,
    'o status do Pedido e do servidor');
  assert.doesNotMatch(exec, /update\(\s*\{\s*status:\s*novoStatus/,
    'o UPDATE direto de status foi retirado');
});

test('4. a revisao e preservada e submetida nos dois escritores', () => {
  assert.match(exec, /function revisaoBase/);
  assert.match(exec, /p_base_revisao:\s*revisaoBase\(\)/);
  assert.equal((exec.match(/p_base_revisao:\s*revisaoBase\(\)/g) || []).length, 2,
    'status e cancelamento submetem a revisao');
});

test('5. so as transicoes do contrato do servidor sao oferecidas', () => {
  assert.match(exec, /TRANSICOES_CANONICAS\s*=\s*\{\s*rascunho:\s*\['recebido'\],\s*recebido:\s*\['confirmado'\]\s*\}/);
  assert.match(exec, /var actions = transicoesOferecidas\(/,
    'a lista renderizada vem do contrato canonico, nao do mapa local mais largo');
});

test('6. transicoes DERIVADAS nunca sao enviadas', () => {
  for (const derivada of ['produzindo', 'entregue']) {
    assert.doesNotMatch(exec, new RegExp("p_novo_status:\\s*'" + derivada + "'"),
      derivada + ' e transicao derivada do servidor');
  }
});

test('7. entregue -> cancelado NAO e oferecido como acao direta', () => {
  assert.match(exec, /statusAtual !== 'cancelado' && statusAtual !== 'entregue'/,
    'um Pedido entregue nao recebe a acao de cancelar');
});

test('8. cancelamento exige motivo nao vazio', () => {
  assert.match(exec, /Informe o motivo do cancelamento/);
  assert.match(exec, /if \(!motivo\)/);
});

test('9. erro de elegibilidade e DISTINTO de inelegivel', () => {
  assert.match(exec, /Nao foi possivel verificar se este Pedido pode ser cancelado/,
    'falha de leitura tem mensagem propria');
  assert.match(exec, /Este Pedido nao pode ser cancelado/,
    'inelegibilidade tem mensagem propria');
  assert.match(exec, /g\.elegivel !== true/);
});

test('10. revisao desatualizada pede recarga explicita, sem retry nem merge', () => {
  assert.match(exec, /PEDIDO_ALTERACAO_REVISAO_DESATUALIZADA/);
  assert.match(src, /Recarregue os dados e refaca a acao/);
  assert.doesNotMatch(exec, /setTimeout|setInterval/,
    'nenhuma retentativa automatica');
});

test('11. sucesso recarrega autoritativamente', () => {
  assert.match(exec, /await reload\(\);[\s\S]{0,40}render\(\);/);
});

test('12. codigos de recusa ficam visiveis', () => {
  assert.match(exec, /Mudanca de status recusada: ' \+ \(data\.codigo/);
  assert.match(exec, /Cancelamento recusado: ' \+ \(data\.codigo/);
});

test('13. nenhum parametro de idempotencia e inventado', () => {
  // Nenhuma das duas RPCs aceita chave na assinatura de db/105.
  const bloco = (exec.match(/rpc\('alterar_status_pedido'[\s\S]{0,300}\)/) || [''])[0]
    + (exec.match(/rpc\('cancelar_pedido'[\s\S]{0,300}\)/) || [''])[0];
  assert.doesNotMatch(bloco, /idempotency/i,
    'nao se inventa parametro ausente do contrato');
});

test('14. nenhum endpoint hospedado', () => {
  assert.doesNotMatch(fs.readFileSync(__filename, 'utf8'), /https?:\/\/[a-z0-9-]+\.supabase\.co/i);
});
