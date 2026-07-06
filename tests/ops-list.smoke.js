const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const opsListSrc = fs.readFileSync(path.join(ROOT, 'js/screens/ops-list.js'), 'utf8');

test('ops-list.js: botao Nova OP orienta Pedido e nao navega para #/ops/nova avulsa', () => {
  const headerBlock = (opsListSrc.match(/function buildHeader\(\)[\s\S]*?function buildKpis/) || [''])[0];
  assert.ok(headerBlock, 'buildHeader nao encontrado');
  assert.match(headerBlock, /Crie a OP a partir de um Pedido\./);
  assert.match(headerBlock, /window\.navigate\(\s*['"]#\/pedidos['"]\s*\)/);
  assert.doesNotMatch(headerBlock, /window\.navigate\(\s*['"]#\/ops\/nova['"]\s*\)/);
});
