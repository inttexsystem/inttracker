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

// ---------------------------------------------------------------------
// 16b2. ACTION-CONTAINMENT-A1 §12.4 — POPULACAO COMPLETA DE COCKPITS
//
// O teste 16b acima prova UMA superficie. Ate A1 essa era a unica prova
// existente, e por isso tres cockpits identicos ficaram anos sem a
// associacao responsiva: op-latex-admin (dois ramos alcancaveis) e
// op-nova (ramo de tecelagem aberta) declaravam a MESMA grade do
// arquetipo A e o MESMO rail sticky, sem nenhum dos dois atributos. Abaixo
// de 1024px eles nunca empilhavam.
//
// A partir daqui a guarda e POPULACIONAL, nao por arquivo: qualquer grade
// que declare a assinatura ratificada do arquetipo A (UI_VISUAL_CONTRACT.md
// §3A) em QUALQUER script de primeira ordem carregado pelo index.html tem
// de possuir data-rv-cockpit, e todo rail sticky do mesmo arquetipo tem de
// possuir data-rv-rail. Uma quinta grade sem marcacao FALHA.
//
// A deteccao e estrutural (assinatura CSS declarada), nunca por nome de
// variavel ou por caminho de arquivo.
// ---------------------------------------------------------------------

/** Scripts de primeira ordem exatamente como o index.html os carrega. */
const FIRST_PARTY = [...indexHtml.matchAll(/<script[^>]*src=["']([^"']+)["']/g)]
  .map((m) => m[1])
  .filter((src) => !/^https?:|^\/\//.test(src))
  .map((src) => src.split('?')[0]);

/**
 * Uma construcao el() por ocorrencia da assinatura, com a lista de
 * atributos que a precede dentro da MESMA chamada. Recorta do inicio da
 * chamada `el(`/`window.el(` mais proxima ate a assinatura, para que um
 * atributo de um irmao anterior nunca seja creditado a esta grade.
 */
function declarationsMatching(text, signature) {
  const out = [];
  for (const hit of text.matchAll(signature)) {
    const before = text.slice(0, hit.index);
    const open = Math.max(before.lastIndexOf('el(', before.length), 0);
    out.push(text.slice(open, hit.index + hit[0].length));
  }
  return out;
}

/** Grade do arquetipo A: 2 colunas, a segunda sendo o rail canonico. */
const ARCHETYPE_A_GRID = /grid-template-columns:\s*minmax\(0,\s*1fr\)\s*var\(--rv-rail-w\)/g;
/** Rail do arquetipo A: sticky no topo, coluna vertical. */
const ARCHETYPE_A_RAIL = /min-width:0;\s*position:sticky;\s*top:0;\s*display:flex;\s*flex-direction:column/g;

const cockpitSurfaces = [];
const railSurfaces = [];
for (const rel of FIRST_PARTY) {
  const text = read(rel);
  for (const decl of declarationsMatching(text, ARCHETYPE_A_GRID)) {
    cockpitSurfaces.push({ rel, marked: /'data-rv-cockpit':\s*''/.test(decl) });
  }
  for (const decl of declarationsMatching(text, ARCHETYPE_A_RAIL)) {
    railSurfaces.push({ rel, marked: /'data-rv-rail':\s*''/.test(decl) });
  }
}

test('16b2. ARCHETYPE_A_COCKPIT_COUNT = 4 e MARKED_COCKPIT_COUNT = 4', () => {
  // As quatro superficies, por rota e estado alcancavel:
  //   OP Tecelagem em producao  js/screens/op-tecelagem-producao-admin.js
  //   OP Latex em producao      js/screens/op-latex-admin.js  (status em_producao)
  //   OP Latex aberta           js/screens/op-latex-admin.js  (status aberta)
  //   OP Tecelagem aberta       js/screens/op-nova.js         (isOpAbertaTecelagem)
  assert.equal(cockpitSurfaces.length, 4,
    `ARCHETYPE_A_COCKPIT_COUNT = ${cockpitSurfaces.length} (HARD STOP — POPULACAO DE COCKPIT MUDOU)`);
  assert.deepEqual(
    cockpitSurfaces.map((c) => c.rel).sort(),
    [
      'js/screens/op-latex-admin.js',
      'js/screens/op-latex-admin.js',
      'js/screens/op-nova.js',
      'js/screens/op-tecelagem-producao-admin.js',
    ],
    'a populacao de cockpits do arquetipo A mudou de arquivo',
  );
  const unmarked = cockpitSurfaces.filter((c) => !c.marked);
  assert.deepEqual(unmarked, [],
    `UNMARKED_ARCHETYPE_A_COCKPIT_COUNT = ${unmarked.length}: ${unmarked.map((c) => c.rel).join(', ')}`);
  assert.equal(cockpitSurfaces.filter((c) => c.marked).length, 4);
});

test('16b3. MARKED_RAIL_COUNT = 4 — todo rail do arquetipo A e membro', () => {
  assert.equal(railSurfaces.length, 4,
    `ARCHETYPE_A_RAIL_COUNT = ${railSurfaces.length} (HARD STOP — POPULACAO DE RAIL MUDOU)`);
  const unmarked = railSurfaces.filter((r) => !r.marked);
  assert.deepEqual(unmarked, [],
    `UNMARKED_RAIL_COUNT = ${unmarked.length}: ${unmarked.map((r) => r.rel).join(', ')}`);
});

test('16b4. o layout 1fr 288px NAO e cockpit e continua sem marcacao', () => {
  // op-nova.js tem um segundo ramo de duas colunas que NAO e o arquetipo A
  // (largura de rail fixa, fora do contrato). Marca-lo inscreveria no
  // contrato responsivo um layout que o contrato visual nunca ratificou.
  const opNova = read('js/screens/op-nova.js');
  assert.match(opNova, /grid-template-columns:1fr 288px/, 'o ramo nao-arquetipo sumiu');
  for (const decl of declarationsMatching(opNova, /grid-template-columns:1fr 288px/g)) {
    assert.ok(!/'data-rv-cockpit':\s*''/.test(decl),
      'o layout 1fr 288px foi marcado como cockpit');
  }
});

test('16b5. css/responsive.css continua sendo o unico dono do breakpoint', () => {
  // A1 nao alterou o CSS: as tres correcoes sao de ASSOCIACAO, nao de regra.
  const tablet = mediaBlock('(max-width: 1023px)');
  assert.match(tablet, /\[data-rv-cockpit\]\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s*!important/);
  assert.match(tablet, /\[data-rv-rail\]\s*\{[\s\S]*?position:\s*static\s*!important/);
  // O !important e o que garante que a declaracao inline nao vence.
  for (const decl of ['grid-template-columns', 'position', 'top', 'width', 'max-width']) {
    assert.match(tablet, new RegExp(`${decl}:[^;]*!important`),
      `${decl} sem !important nao venceria o estilo inline do cockpit`);
  }
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
  // O sujeito deste guard e a correcao responsiva. Uma migracao AUTORIZADA
  // POSTERIOR (BATCH-02: db/89) nao pertence a esse sujeito e nao pode ser
  // lida como delta desta correcao; a garantia original — a correcao
  // responsiva nao toca o banco — segue integral.
  const POSTERIOR_AUTORIZADO = [
    /^db\/89_pedido_commercial_date_and_number_control\.sql$/,
    /^db\/90_pedido_proximo_numero_suggestion_rpc\.sql$/,
  ];
  for (const rel of all) {
    if (POSTERIOR_AUTORIZADO.some((re) => re.test(rel))) continue;
    assert.equal(/^db\//.test(rel), false, 'nenhum arquivo db/** pode mudar: ' + rel);
    assert.equal(/\.sql$/.test(rel), false, 'nenhum .sql pode mudar: ' + rel);
  }
});

test('os arquivos protegidos nao cresceram em relacao a bbd5f85', () => {
  // 2709 -> 2716 em pedido-detail-events.js: +7 linhas da passada 3 de altura,
  // todas no bloco normalizeMovementModalControls, que registra a divisao do
  // antigo MOVEMENT_CONTROL_HEIGHT generico em um minimo exclusivo de textarea.
  // Nenhuma logica nova; o ratchet e reancorado, nunca afrouxado.
  //
  // 2716 -> 2720: +4 linhas da passada 8 de tabela, todas em
  // buildTransitionPendingTable. As tres colunas de quantidade passaram de
  // centralizadas para alinhadas a direita no cabecalho E no valor, e cada
  // celula de valor ganhou `data-num`, o dono canonico dos algarismos
  // tabulares (css/tokens.css). Nenhuma logica nova, nenhum calculo alterado.
  const LIMITS = {
    'js/screens/pedido-detail-events.js': 2729,
    'js/screens/pedido-detail-progress.js': 919,
  };
  for (const [rel, limit] of Object.entries(LIMITS)) {
    const lines = read(rel).split('\n');
    // Um arquivo terminado em newline produz um ultimo elemento vazio.
    const physical = lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
    assert.ok(physical <= limit, rel + ' tem ' + physical + ' linhas, limite ' + limit);
  }
});

// ---------------------------------------------------------------------
// BATCH-03 — layout operacional compacto de #/pedidos/novo.
//
// O sujeito destas provas e o CONTRATO estrutural: a grade base declarada
// em js/screens/pedido-form.js e os breakpoints que a adaptam nesta folha.
// Assim como o resto deste arquivo, um smoke Node nao tem engine de layout
// e nao mede geometria real; ele prova o contrato que a produz.
// ---------------------------------------------------------------------

const pedidoForm = read('js/screens/pedido-form.js');
const itemRow = read('js/screens/pedido-item-row-editor.js');

// A grade base (sem media query) de `data-rv-pedido-dados`, lida do inline
// style do proprio modulo — nunca de uma copia local.
function pedidoDadosGridBase() {
  const anchor = pedidoForm.indexOf("'data-rv-pedido-dados'");
  assert.notEqual(anchor, -1, 'a grade Dados gerais deve declarar data-rv-pedido-dados');
  const trecho = pedidoForm.slice(anchor, anchor + 600);
  const m = trecho.match(/grid-template-columns:([^;']+)/);
  assert.ok(m, 'grid-template-columns ausente na grade Dados gerais');
  return m[1].trim();
}

test('B3/1. no desktop amplo os cinco campos de Dados gerais ficam em UMA linha', () => {
  const base = pedidoDadosGridBase();
  const tracks = base.match(/minmax\([^)]*\)/g) || [];
  assert.equal(tracks.length, 5,
    'a grade base deve ter exatamente 5 colunas (uma linha), got: ' + base);
  // Nenhuma das cinco pode ser fixa em px: a linha tem de respirar com a tela.
  assert.doesNotMatch(base, /\d+px/, 'nenhuma coluna pode ser fixa em px: ' + base);
});

test('B3/2. a proporcao privilegia Cliente e mantem os quatro curtos compactos', () => {
  const pesos = (pedidoDadosGridBase().match(/(\d+)fr/g) || []).map((s) => parseInt(s, 10));
  assert.equal(pesos.length, 5);
  const total = pesos.reduce((a, b) => a + b, 0);
  const pct = pesos.map((p) => (p / total) * 100);
  assert.ok(pct[0] >= 28 && pct[0] <= 32, 'Cliente deve ficar perto de 30%: ' + pct[0].toFixed(1));
  for (let i = 1; i <= 3; i += 1) {
    assert.ok(pct[i] >= 16 && pct[i] <= 18.5,
      'Numero/Data/Prazo devem ficar entre 16% e 18.5%: ' + pct[i].toFixed(1));
  }
  assert.ok(pct[4] > 0 && pct[4] <= 20, 'Status recebe a largura restante: ' + pct[4].toFixed(1));
  // Cliente e o unico campo de texto livre longo: ele tem de ser o mais largo.
  assert.ok(pesos[0] > Math.max(pesos[1], pesos[2], pesos[3], pesos[4]),
    'Cliente deve ser a coluna mais larga');
});

test('B3/3. a ordem visual e Cliente -> Numero -> Data -> Prazo -> Status', () => {
  const rotulos = ['Cliente', 'Número do pedido', 'Data do pedido', 'Prazo desejado', 'Status inicial'];
  const posicoes = rotulos.map((r) => {
    const i = pedidoForm.indexOf("buildFieldLabel('" + r + "'");
    assert.notEqual(i, -1, 'rotulo ausente: ' + r);
    return i;
  });
  for (let i = 1; i < posicoes.length; i += 1) {
    assert.ok(posicoes[i] > posicoes[i - 1],
      rotulos[i] + ' deve vir depois de ' + rotulos[i - 1]);
  }
});

test('B3/4. a queda por largura e 5 -> 3 -> 2 -> 1, na ordem correta da cascata', () => {
  const colunasEm = (condicao) => {
    const bloco = mediaBlock(condicao);
    const m = bloco.match(/\[data-rv-pedido-dados\]\s*\{[^}]*grid-template-columns:\s*([^;]+);/);
    assert.ok(m, 'data-rv-pedido-dados ausente em @media ' + condicao);
    return m[1].trim();
  };
  assert.match(colunasEm('(max-width: 1279px)'), /repeat\(3,/, 'medio deve ser 3 colunas (3 + 2)');
  assert.match(colunasEm('(max-width: 1023px)'), /repeat\(2,/, 'estreito deve ser 2 colunas');
  assert.match(colunasEm('(max-width: 767px)'), /minmax\(0,\s*1fr\)/, 'mobile deve ser 1 coluna');

  // A cascata so funciona do mais largo para o mais estreito: se 1279 viesse
  // depois de 1023, um viewport de 900px receberia 3 colunas.
  const i1279 = css.indexOf('@media (max-width: 1279px)');
  const i1023 = css.indexOf('@media (max-width: 1023px)');
  const i767 = css.indexOf('@media (max-width: 767px)');
  assert.ok(i1279 < i1023 && i1023 < i767,
    'os breakpoints devem aparecer do mais largo para o mais estreito');
});

test('B3/5. um layout FIXO de duas linhas para todo desktop nao sobrevive', () => {
  // As duas grades antigas (2 colunas + 3 colunas) somadas a margem entre elas
  // eram a origem da faixa vertical vazia.
  assert.doesNotMatch(pedidoForm, /grid-template-columns:1fr 1fr; gap:20px; margin-bottom:16px/,
    'a grade fixa de 2 colunas do cabecalho nao pode voltar');
  assert.doesNotMatch(pedidoForm, /grid-template-columns:1fr 1fr 1fr; gap:20px/,
    'a grade fixa de 3 colunas do cabecalho nao pode voltar');
  assert.equal((pedidoForm.match(/'data-pedido-header-grid'/g) || []).length, 1,
    'deve existir exatamente UMA grade de Dados gerais');
});

test('B3/6. o contrato de densidade compacta e respeitado', () => {
  // Os QUATRO cartoes de layout: Dados gerais e Itens (padding 16px + 12px de
  // distancia entre cartoes), Instrucoes gerais e Salvar rascunho. Os cartoes
  // transitorios de carregamento/erro nao sao layout e ficam fora.
  assert.equal((pedidoForm.match(/padding:16px; margin-bottom:12px;/g) || []).length, 2,
    'Dados gerais e Itens devem usar padding 16px e 12px entre cartoes');
  // O tamanho de fonte deste titulo passou a ser propriedade de um token de
  // papel na passada 6 de tipografia (COMPONENT_HEADING, o mesmo 16px). O
  // sujeito deste teste continua sendo a DENSIDADE: padding 16px e a folga de
  // 10px entre titulo e conteudo.
  assert.match(pedidoForm, /padding:16px;'\s*\},\s*\n\s*window\.el\('div', \{ style: 'font-size:var\(--rv-fs-component-heading\); font-weight:700; color:[^;]+; margin-bottom:10px;' \}, 'Instruções gerais'\)/,
    'o cartao de Instrucoes gerais deve usar padding 16px');
  assert.match(pedidoForm, /'font-size:var\(--rv-fs-component-heading\); font-weight:700; color:var\(--rv-text-primary\); margin-bottom:10px;' \}, 'Instruções gerais'/,
    'o titulo de Instrucoes gerais usa o token canonico de texto');
  assert.match(pedidoForm, /padding:16px; display:flex; flex-direction:column/,
    'o cartao de Salvar rascunho deve usar padding 16px');
  assert.doesNotMatch(pedidoForm, /padding:16px 20px/, 'nenhum cartao pode manter o padding largo antigo');
  // Nenhum cartao de LAYOUT conserva a folga antiga de 14px. O resumo
  // pos-salvamento e outro estado de tela e nao pertence a este sujeito.
  assert.doesNotMatch(pedidoForm, /box-shadow:0 1px 2px rgba\(20,30,45,\.04\); padding:[^;]+; margin-bottom:14px/,
    'a distancia entre os cartoes de layout caiu para 12px');

  // Titulo -> campos: 12px.
  assert.match(pedidoForm, /margin-bottom:12px;' \}, 'Dados gerais'/);

  // ALTURA DE CAMPO — CORRECAO PROGRESSIVA DE PEDIDO-SCREEN-GROUP-1.
  //
  // O fato que BATCH-03 possui, e que este teste existe para proteger, e UMA
  // ALTURA UNICA para os cinco campos de Dados gerais — nao o numero 40. Em
  // BATCH-03 os cinco compartilhavam a mesma caixa, entao um literal servia
  // como prova.
  //
  // A passada 7 (UIC-006) quebrou a invariante em silencio: Cliente virou o
  // trigger canonico do select-popover e Status virou o campo somente-leitura
  // canonico, e ambos declaram `height:var(--rv-h-compact)` (32px). A linha
  // passou a renderizar 32, 40, 40, 40, 32 e nenhum teste percebeu, porque o
  // literal continuava presente nos tres campos que sobraram.
  //
  // A invariante e restaurada no degrau canonico. O sujeito deste teste deixa
  // de ser um literal e passa a ser a PROPRIEDADE: os cinco campos resolvem
  // para a MESMA altura, e essa altura pertence ao enum de controle. 40px nao
  // pertencia — o enum e 32/34/38.
  const fieldBox = /function fieldBoxStyle\([\s\S]*?\n    \}/.exec(pedidoForm);
  assert.ok(fieldBox, 'a caixa de campo de Dados gerais deve ter um dono unico');
  assert.match(fieldBox[0], /height:var\(--rv-h-compact\)/,
    'a caixa propria deve declarar o degrau canonico de campo');
  assert.match(fieldBox[0], /box-sizing:border-box/,
    'a altura fixa so nao corta o conteudo com box-sizing:border-box');
  assert.doesNotMatch(fieldBox[0], /min-height:40px/,
    '40px nao pertence ao enum de altura de controle (32/34/38)');
  // Os dois campos que NAO usam a caixa propria sao donos compartilhados, e
  // ambos declaram o mesmo degrau — e isso que fecha a invariante.
  const popover = read('js/select-popover.js');
  assert.equal((popover.match(/height:var\(--rv-h-compact\)/g) || []).length, 2,
    'o trigger de selecao e o campo somente-leitura declaram o mesmo degrau');
  assert.match(pedidoForm, /createSelectPopover\(\{[\s\S]{0,200}?ariaLabel: 'Cliente'/,
    'Cliente e o trigger canonico');
  assert.match(pedidoForm, /createReadonlyFieldValue\(\{ text: 'Rascunho' \}\)/,
    'Status inicial e o campo somente-leitura canonico');
  // E o padding horizontal tambem coincide, senao o texto dos cinco campos nao
  // se alinharia verticalmente mesmo com a altura igual.
  assert.match(fieldBox[0], /padding:0 12px/,
    'a caixa propria usa o mesmo padding horizontal de 12px do trigger');
  const gap = pedidoForm.match(/column-gap:(\d+)px; row-gap:(\d+)px/);
  assert.ok(gap, 'a grade deve declarar column-gap/row-gap explicitos');
  assert.ok(Number(gap[1]) >= 12 && Number(gap[1]) <= 16, 'gap horizontal entre 12 e 16px');
  assert.ok(Number(gap[2]) <= 12, 'gap vertical compacto');

  // Nenhuma faixa vazia reservada sob um unico campo.
  assert.doesNotMatch(pedidoForm, /data-pedido-numero-erro': '1',[\s\S]{0,160}?min-height/,
    'a linha de mensagem nao pode reservar altura quando esta vazia');
});

test('B3/7. o cartao de itens ficou compacto sem encolher alvo de clique', () => {
  assert.match(itemRow, /padding:7px 14px; border-bottom/, 'a linha de item deve usar padding 7px 14px');
  assert.match(itemRow, /padding:8px 14px; background:/, 'o cabecalho da tabela deve usar padding 8px 14px');
  assert.match(itemRow, /padding:8px 14px; background:var\(--rv-surface-subtle\);/, 'o cabecalho usa a superficie sutil canonica');
  assert.match(pedidoForm, /padding:8px 14px; background:/, 'o resumo deve usar padding 8px 14px');
  assert.match(pedidoForm, /padding:8px 14px; background:var\(--rv-surface-subtle\);/, 'o resumo usa a superficie sutil canonica');
  // Os CONTROLES continuam do mesmo tamanho: a densidade veio da folga, nao
  // do alvo de clique.
  //
  // BATCH-03-SELECT-TRIGGER-GEOMETRY-FORWARD-CORRECTION-A2
  // A passada 7 (UIC-006) substituiu os dois selects nativos da linha pelo
  // trigger canonico do select-popover, que declara a propria geometria de
  // campo: 32px de altura (--rv-h-compact) com padding 0/12px e box-sizing
  // border-box. O alvo de clique NAO encolheu — 32px de altura contra os
  // ~30px do select nativo anterior (13.5px de texto + 6px acima e abaixo).
  // A correcao vale SO para o trigger; metragem e observacao continuam
  // declarando 6px 8px, e sao verificados literalmente aqui.
  assert.ok((itemRow.match(/padding:6px 8px/g) || []).length >= 2,
    'metragem e observacao mantem o padding de 6px 8px');
  assert.match(itemRow, /padding:6px 8px; font-size:13\.5px/,
    'os campos de texto da linha mantem o tamanho de alvo');
  // Tipo e Modelo sao o trigger canonico, cuja geometria e do dono unico.
  assert.match(itemRow, /createSelectPopover\(\{[^}]*ariaLabel: 'Tipo'/);
  assert.match(itemRow, /createSelectPopover\(\{[^}]*ariaLabel: 'Modelo'/);
  const popover = read('js/select-popover.js');
  assert.match(popover, /height:var\(--rv-h-compact\)/,
    'o trigger declara a altura canonica de campo');
  assert.match(popover, /padding-top:0; padding-bottom:0;/,
    'nenhum padding vertical compete com a altura fixa');
  assert.match(popover, /padding-left:12px; padding-right:12px;/,
    'o trigger declara o padding horizontal canonico de 12px');
  assert.match(popover, /box-sizing:border-box/,
    'a altura fixa so nao corta o texto com box-sizing:border-box');
});

test('B3/8. a tabela de itens tem container PROPRIO de rolagem (sem clipping no estreito)', () => {
  assert.match(pedidoForm, /'data-rv-table-scroll': '1', style: 'overflow-x:auto;'/,
    'o wrapper da tabela deve ser o dono do overflow');
  assert.match(itemRow, /min-width:920px/, 'a linha declara sua largura minima propria');
});

test('B3/9. Tipo continua antes de Modelo e nenhum modal de item voltou', () => {
  const iTipo = itemRow.indexOf("'data-item-tipo-select'");
  const iModelo = itemRow.indexOf("'data-item-modelo-select'");
  assert.ok(iTipo > 0 && iModelo > iTipo, 'Tipo deve ser declarado antes de Modelo');
  assert.match(itemRow, /row\.appendChild\(tipoSelect\);\s*\n\s*row\.appendChild\(modeloSelect\);/,
    'na linha renderizada Tipo vem antes de Modelo');
  for (const [nome, src] of [['pedido-form.js', pedidoForm], ['pedido-item-row-editor.js', itemRow]]) {
    assert.doesNotMatch(src, /data-item-modal/, nome + ' nao pode reintroduzir o modal de item');
    assert.doesNotMatch(src, /document\.body\.appendChild/, nome + ' nao pode montar overlay de item');
  }
});

test('B3/10. pedido-form.js nao regride para o patamar excepcional de tamanho', () => {
  const linhas = pedidoForm.split('\n');
  const fisicas = linhas[linhas.length - 1] === '' ? linhas.length - 1 : linhas.length;
  assert.ok(fisicas <= 900, 'pedido-form.js tem ' + fisicas + ' linhas, limite 900');
  const rowLinhas = itemRow.split('\n');
  const rowFisicas = rowLinhas[rowLinhas.length - 1] === '' ? rowLinhas.length - 1 : rowLinhas.length;
  assert.ok(rowFisicas <= 500, 'a extracao de BATCH-02 continua no limite normal: ' + rowFisicas);
});
