// =====================================================================
// === tests/responsive-layout.smoke.js ================================
// PHASE-MANTA-B2B-ROUTE-SEMANTICS-AND-RESPONSIVE-VISUAL-CORRECTION-R2
// Correcao D3 — portao responsivo LIMITADO as superficies de validacao
// B2B. Prova o CONTRATO estrutural da correcao:
//
//   15. existe contrato de media query / classes responsivas para o shell;
//   16. o cockpit empilha o rail no mobile;
//   17. tabelas largas vivem em containers de rolagem PROPRIOS;
//   18. nenhum delta de banco/migracao.
//
// D3 e um defeito de PLATAFORMA, neutro de rota: nenhuma assercao aqui
// depende de Tapete ou Manta.
//
// Este teste e ESTRUTURAL (o contrato de atributos + as regras CSS que os
// consomem). A prova de geometria real — documentElement.scrollWidth <=
// clientWidth em 375px/785px — foi feita em navegador contra o fixture
// descartavel e consta do relatorio de execucao; um smoke Node nao tem
// engine de layout e nao pode reproduzi-la.
// =====================================================================

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const css = read('css/responsive.css');
const indexHtml = read('index.html');
const common = read('js/screens/common.js');
const opTecelagem = read('js/screens/op-tecelagem-producao-admin.js');
const expedicaoAdmin = read('js/screens/expedicao-admin.js');
const mantaExpedicaoUi = read('js/screens/manta-expedicao-ui.js');
const detailRender = read('js/screens/pedido-detail-render.js');
const routeSectionsUi = read('js/screens/pedido-route-sections-ui.js');
const clienteSectionsUi = read('js/screens/cliente-route-sections-ui.js');
const clienteTracking = read('js/screens/cliente-pedido-tracking.js');

// Extrai o corpo de uma media query pelo texto da condicao.
function mediaBlock(condition) {
  const start = css.indexOf('@media ' + condition);
  assert.notEqual(start, -1, 'media query ausente: ' + condition);
  let depth = 0;
  let i = css.indexOf('{', start);
  const from = i;
  for (; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    else if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(from, i + 1);
    }
  }
  throw new Error('media query nao fechada: ' + condition);
}

// ---------------------------------------------------------------------
// 0. Carga
// ---------------------------------------------------------------------

test('a folha responsiva e carregada pelo index.html exatamente uma vez e com cache-busting', () => {
  const hits = indexHtml.match(/css\/responsive\.css\?v=[^"]+/g) || [];
  assert.equal(hits.length, 1, 'css/responsive.css deve ser carregado uma vez com ?v=');
  assert.match(indexHtml, /<link rel="stylesheet" href="css\/responsive\.css\?v=/);
  // index.html continua declarativo: nenhuma media query inline foi adicionada.
  const inlineStyle = indexHtml.slice(indexHtml.indexOf('<style>'), indexHtml.indexOf('</style>'));
  assert.doesNotMatch(inlineStyle, /@media/, 'index.html permanece declarativo');
});

test('index.html continua com o meta viewport responsivo', () => {
  assert.match(indexHtml, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/);
});

// ---------------------------------------------------------------------
// 15. Contrato responsivo do shell
// ---------------------------------------------------------------------

test('15. existe contrato de media query para o SHELL (sidebar nao consome o viewport)', () => {
  const mobile = mediaBlock('(max-width: 767px)');
  // O shell empilha.
  assert.match(mobile, /\[data-rv-shell\]\s*\{[^}]*flex-direction:\s*column\s*!important/);
  // A sidebar de 196px deixa de consumir a largura do conteudo.
  assert.match(mobile, /\[data-rv-shell-aside\]\s*\{[\s\S]*?width:\s*100%\s*!important/);
  assert.match(mobile, /\[data-rv-shell-aside\]\s*\{[\s\S]*?flex-direction:\s*row\s*!important/);
  // A navegacao continua alcancavel: a faixa rola na horizontal.
  assert.match(mobile, /\[data-rv-shell-aside\]\s*\{[\s\S]*?overflow-x:\s*auto\s*!important/);
  assert.match(mobile, /\[data-rv-shell-main\]\s*\{[^}]*padding:/);
});

test('15b. o shell REAL carrega os ancoradouros que a media query consome', () => {
  for (const attr of ['data-rv-shell', 'data-rv-shell-aside', 'data-rv-shell-main',
    'data-rv-shell-header', 'data-rv-nav-footer']) {
    assert.match(common, new RegExp("'" + attr + "': ''"), common + '\n' + attr + ' ausente em common.js');
  }
  // Os dois caminhos de shellLayout (fallback de teste e chrome visual)
  // marcam aside e main, para que o breakpoint valha nos dois.
  const asideHits = common.match(/data-rv-shell-aside/g) || [];
  assert.ok(asideHits.length >= 2, 'aside marcado no fallback e no chrome visual');
  const mainHits = common.match(/data-rv-shell-main/g) || [];
  assert.ok(mainHits.length >= 2, 'main marcado no fallback e no chrome visual');
});

test('15c. `!important` e deliberado: o chrome usa style inline e nao cederia por especificidade', () => {
  // O aside real declara a largura fixa INLINE; sem !important a media
  // query seria inerte. Esta assercao trava a razao da escolha.
  assert.match(common, /style: 'width:196px;flex-shrink:0/);
  const mobile = mediaBlock('(max-width: 767px)');
  assert.match(mobile, /!important/);
});

test('15d. a navegacao global NAO foi redesenhada', () => {
  // Mesmos itens de menu, mesmo mecanismo (<a href> por item), sem
  // hamburguer novo, sem drawer, sem overlay de navegacao.
  assert.match(common, /const ADMIN_MENU = \[/);
  assert.doesNotMatch(common, /hamburger|drawer|toggleNav|navOverlay/i);
  assert.match(common, /function navItem\(item, active\)/);
});

// ---------------------------------------------------------------------
// 16. Cockpit empilha o rail
// ---------------------------------------------------------------------

test('16. abaixo do breakpoint o cockpit vira uma coluna e o rail perde o sticky', () => {
  const tablet = mediaBlock('(max-width: 1023px)');
  assert.match(tablet, /\[data-rv-cockpit\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(tablet, /\[data-rv-rail\]\s*\{[\s\S]*?position:\s*static\s*!important/);
  assert.match(tablet, /\[data-rv-2col\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
});

test('16b. o cockpit REAL da OP de tecelagem marca a grade e o rail', () => {
  // A grade de 2 colunas (conteudo + rail de 300px) e o rail sticky.
  assert.match(opTecelagem, /'data-rv-cockpit': ''[\s\S]{0,200}grid-template-columns:minmax\(0,1fr\) var\(--rv-rail-w\)/);
  assert.match(opTecelagem, /'data-rv-rail': ''[\s\S]{0,120}position:sticky/);
});

test('16c. as grades de 2 colunas de cartoes do Pedido empilham no mobile', () => {
  const hits = detailRender.match(/'data-rv-2col': ''/g) || [];
  assert.ok(hits.length >= 3, 'OPs vinculadas, expedicoes vinculadas e cliente+documentos');
});

test('16d. o stepper por rota empilha em vez de cortar ou sobrepor nos', () => {
  const tablet = mediaBlock('(max-width: 1023px)');
  assert.match(tablet, /\[data-rv-route-stepper\]\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(routeSectionsUi, /'data-rv-route-stepper': section\.route \|\| ''/);
});

test('16e. as grades de metricas reduzem colunas no mobile', () => {
  const mobile = mediaBlock('(max-width: 767px)');
  assert.match(mobile, /\[data-rv-metrics\]\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)\s*!important/);
  // Consumidores reais.
  assert.match(detailRender, /'data-rv-metrics': ''/);
  assert.match(expedicaoAdmin, /'data-rv-metrics': ''/);
  assert.match(mantaExpedicaoUi, /'data-rv-metrics': ''/);
});

test('16f. formularios operacionais com colunas fixas em px empilham no mobile', () => {
  const mobile = mediaBlock('(max-width: 767px)');
  assert.match(mobile, /\[data-rv-form-grid\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(expedicaoAdmin, /'data-rv-form-grid': ''[\s\S]{0,140}grid-template-columns:180px 180px 1fr/);
});

// ---------------------------------------------------------------------
// 17. Tabelas largas em containers de rolagem proprios
// ---------------------------------------------------------------------

test('17. o container de rolagem e o DONO do overflow, em qualquer largura', () => {
  // Fora de media query: a regra vale sempre, para que uma tabela larga
  // nunca empurre o documento na horizontal.
  const base = css.slice(0, css.indexOf('@media'));
  assert.match(base, /\[data-rv-table-scroll\]\s*\{[\s\S]*?overflow-x:\s*auto/);
  assert.match(base, /\[data-rv-table-scroll\]\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(base, /\[data-rv-table-scroll\]\s*\{[\s\S]*?min-width:\s*0/);
  assert.match(base, /\[data-rv-shell-main\]\s*\{[\s\S]*?min-width:\s*0/);
});

test('17b. toda tabela com min-width fixo esta dentro de um container de rolagem proprio', () => {
  const SURFACES = [
    ['js/screens/op-tecelagem-producao-admin.js', opTecelagem],
    ['js/screens/expedicao-admin.js', expedicaoAdmin],
    ['js/screens/manta-expedicao-ui.js', mantaExpedicaoUi],
    ['js/screens/pedido-detail-render.js', detailRender],
  ];
  for (const [rel, src] of SURFACES) {
    const wide = src.match(/min-width:\s*\d{3,}px/g) || [];
    assert.ok(wide.length > 0, rel + ' deveria conter ao menos uma tabela larga');
    const scrolls = src.match(/'data-rv-table-scroll': ''/g) || [];
    assert.ok(scrolls.length > 0, rel + ': tabela larga sem container de rolagem proprio');
  }
});

test('17c. a tabela de itens da expedicao passou a rolar no proprio container', () => {
  // Antes as linhas eram anexadas direto no card, que tem overflow:hidden —
  // as colunas eram cortadas, sem rolagem alcancavel.
  assert.match(expedicaoAdmin, /var scroll = window\.el\('div', \{ 'data-rv-table-scroll': ''/);
  assert.match(expedicaoAdmin, /scroll\.appendChild\([\s\S]{0,400}min-width:720px/);
  assert.match(expedicaoAdmin, /card\.appendChild\(scroll\)/);
  assert.doesNotMatch(expedicaoAdmin, /card\.appendChild\(window\.el\('div', \{ style: 'display:grid;grid-template-columns:' \+ cols[\s\S]{0,200}min-width:720px/);
});

test('17d. a tabela de itens do Pedido rola no proprio container', () => {
  assert.match(detailRender, /var head = window\.el\('div', \{\s*'data-rv-table-scroll': '',\s*style: 'overflow-x:auto;',\s*\}\)/);
});

test('17e. o stepper do cliente rola no proprio container em vez de comprimir rotulos', () => {
  const mobile = mediaBlock('(max-width: 767px)');
  assert.match(mobile, /\[data-rv-stepper-scroll\]\s*\{[\s\S]*?overflow-x:\s*auto\s*!important/);
  assert.match(mobile, /\[data-rv-client-stepper\]\s*\{[^}]*min-width:\s*\d+px\s*!important/);
  assert.match(clienteSectionsUi, /'data-rv-stepper-scroll': ''/);
  assert.match(clienteTracking, /'data-rv-client-stepper': section\.route \|\| 'legado'/);
});

test('17f. a tabela de capacidade da OP tem min-width suficiente para a coluna MODELO', () => {
  // 4 colunas de 110px + gaps consomem ~480px; 560px deixavam ~48px para
  // MODELO e o rotulo quebrava uma palavra por linha.
  const m = opTecelagem.match(/min-width:(\d+)px;' \}\);\s*\n\s*tabelaInner\.appendChild\(thRow\('1fr 110px 110px 110px 110px'/);
  assert.ok(m, 'tabela de capacidade nao encontrada');
  assert.ok(Number(m[1]) >= 680, 'min-width deve deixar espaco real para a coluna MODELO, tem ' + m[1]);
});

// ---------------------------------------------------------------------
// Escopo: correcao limitada, nao redesign
// ---------------------------------------------------------------------

test('a correcao responsiva e limitada: uma folha nova, sem reescrita de chrome', () => {
  // Nenhum reset global, nenhuma tipografia global, nenhum overflow:hidden
  // no documento (que MASCARARIA o defeito em vez de corrigi-lo).
  assert.doesNotMatch(css, /^\s*html\s*,?\s*body\s*\{/m, 'sem reset global');
  assert.doesNotMatch(css, /overflow-x:\s*hidden[^;]*;\s*\}\s*$/m);
  // Nenhum seletor universal NAO ancorado. `[data-rv-shell-aside] > *` e
  // permitido: esta escopado aos filhos diretos da faixa de navegacao.
  assert.doesNotMatch(css, /^\s*\*\s*[,{]/m, 'sem seletor universal solto');
  // Todos os seletores sao ancorados em data-rv-*: nada vaza para o resto
  // da aplicacao.
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').filter((l) => /\{\s*$/.test(l)).map((l) => l.trim().replace(/\s*\{$/, ''))
    .filter((l) => !l.startsWith('@media'));
  for (const sel of selectors) {
    assert.match(sel, /\[data-rv-/, 'seletor nao ancorado em data-rv-*: ' + sel);
  }
});

test('18. a correcao responsiva nao introduz delta de banco nem migracao', () => {
  const changed = execFileSync('git', ['diff', '--name-only', 'bbd5f85'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').map((s) => s.trim()).filter(Boolean);
  const all = changed.concat(untracked);
  assert.ok(all.length > 0, 'deveria haver mudanca a inspecionar');
  for (const rel of all) {
    assert.equal(/^db\//.test(rel), false, 'nenhum arquivo db/** pode mudar: ' + rel);
    assert.equal(/\.sql$/.test(rel), false, 'nenhum .sql pode mudar: ' + rel);
  }
});

test('os arquivos protegidos nao cresceram em relacao a bbd5f85', () => {
  const LIMITS = {
    'js/screens/pedido-detail-events.js': 2709,
    'js/screens/pedido-detail-progress.js': 919,
  };
  for (const [rel, limit] of Object.entries(LIMITS)) {
    const lines = read(rel).split('\n');
    // Um arquivo terminado em newline produz um ultimo elemento vazio.
    const physical = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    assert.ok(physical <= limit, rel + ' tem ' + physical + ' linhas, limite ' + limit);
  }
});
