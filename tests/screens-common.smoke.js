// Smoke test do módulo js/screens/common.js (SCREENS-COMMON-MODULE-A).
//
// Garante que a extração de shellLayout + ADMIN_MENU do <script> inline de
// index.html para js/screens/common.js preservou o comportamento exato.
//
// Estáticos:
//   1. js/screens/common.js existe;
//   2. é script clássico (não ES module);
//   3. sintaxe JS válida (node --check);
//   4. index.html carrega js/screens/common.js EXATAMENTE UMA VEZ, sem type=module;
//   5. ordem router → system-screens → common → jsPDF → inline (relativa a
//      system-screens.js é flexível, mas common deve vir depois de router e
//      antes do inline);
//   6. inline NÃO contém mais: function shellLayout, const ADMIN_MENU;
//   7. inline ainda contém: function screenPainel, function main,
//      window.RAVATEX_ROUTER.setRoutes, demais telas;
//   8. inline ainda referencia shellLayout(...)/ADMIN_MENU como identificador
//      bare (não foi reescrito para window.shellLayout/window.ADMIN_MENU);
//   9-10. js/screens/common.js não contém chamadas Supabase
//      (supa.from/.insert/.update/.delete/.rpc) nem `createClient`;
//  11-12. nenhum service_role nem password literal em js/screens/common.js;
//  13. index.html não contém service_role nem password literal (preservado);
//  14. ADMIN_MENU não é redeclarado no inline (apenas uma declaração em
//      todo o projeto: js/screens/common.js).
//
// Runtime (carrega js/ui.js + js/screens/common.js num vm.Context com stubs
// de CURRENT_USER/logout):
//  15-17. window.RAVATEX_SCREENS.common existe e expõe ADMIN_MENU e
//      shellLayout;
//  18. window.ADMIN_MENU e window.shellLayout (globais legados) existem;
//  19. ADMIN_MENU tem exatamente os 9 itens esperados, na ordem original;
//  20. shellLayout é função;
//  21. shellLayout(menuItems, contentNode) retorna nó renderizável (<div>
//      com header + aside + main);
//  22. shellLayout renderiza um <a> por item de menuItems, com href/label
//      corretos;
//  23. shellLayout(ADMIN_MENU, content) renderiza os 9 itens do ADMIN_MENU;
//  24. shellLayout inclui o nome do CURRENT_USER no header quando definido;
//  25. shellLayout inclui botão "Sair" cujo onclick é window.logout;
//  26. clicar no botão "Sair" aciona o window.logout (preserva ação de
//      logout);
//  27. shellLayout(menuItems, contentNode) insere o contentNode dentro do
//      <main>;
//
// Integração:
//  28. screenPainel() (definida no inline) ainda renderiza via shellLayout
//      num mock de boot completo;
//
// Regressão:
//  29. tests/system-screens.smoke.js e tests/router.smoke.js continuam
//      verdes (executados externamente, não nesta suíte — ver relatório);
//
// Boot:
//  30. boot: ui.js + badges.js + router.js + system-screens.js + common.js +
//      inline coexistem sem SyntaxError de duplicate identifier.

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const ROOT    = path.resolve(__dirname, '..');
const INDEX   = path.join(ROOT, 'index.html');
const COMMON  = path.join(ROOT, 'js', 'screens', 'common.js');
const CAD     = path.join(ROOT, 'js', 'screens', 'cadastros.js');
const OPS     = path.join(ROOT, 'js', 'screens', 'ops-list.js');
const EF      = path.join(ROOT, 'js', 'screens', 'entrega-form.js');
const EW      = path.join(ROOT, 'js', 'screens', 'entrega-writes.js');
const FORN    = path.join(ROOT, 'js', 'screens', 'fornecedor.js');
const UI      = path.join(ROOT, 'js', 'ui.js');
const BADGES  = path.join(ROOT, 'js', 'badges.js');
const ROUTER  = path.join(ROOT, 'js', 'router.js');
const SYSTEM_SCREENS = path.join(ROOT, 'js', 'screens', 'system-screens.js');
// INTTEX-BRAND-ASSET-INTEGRATION: a folha responsiva é lida, nunca escrita —
// BRAND/5 prova que o breakpoint da troca de forma da marca é o MESMO que ela
// já possui, e que esta ordem não a alterou.
const responsiveCss = fs.readFileSync(path.join(ROOT, 'css', 'responsive.css'), 'utf8');

// O <script> inline de index.html não existe mais: o bootstrap virou
// js/boot.js e as telas viraram módulos próprios (js/screens/painel.js,
// op-nova.js, ...). Os testes abaixo que falavam em "inline" descrevem o
// BOOT SCRIPT do app e o CHAMADOR do shell — agora endereçados pelos donos
// atuais. Nenhuma garantia foi afrouxada; só reapontada.
const appSource  = require('./_app-source.js');
const bootSrc    = appSource.readSource('js/boot.js');
const painelSrc  = appSource.readSource(path.join('js', 'screens', 'painel.js'));
const opNovaSrc  = appSource.readSource(path.join('js', 'screens', 'op-nova.js'));

const indexSrc   = fs.readFileSync(INDEX,  'utf8');
const commonSrc  = fs.readFileSync(COMMON, 'utf8');
const cadSrc     = fs.readFileSync(CAD,    'utf8');
const opsSrc     = fs.readFileSync(OPS,    'utf8');
const efSrc      = fs.readFileSync(EF,     'utf8');
const ewSrc      = fs.readFileSync(EW,     'utf8');
const fornSrc    = fs.readFileSync(FORN,   'utf8');
const uiSrc      = fs.readFileSync(UI,     'utf8');
const badgesSrc  = fs.readFileSync(BADGES, 'utf8');
const routerSrc  = fs.readFileSync(ROUTER, 'utf8');
const sysSrc     = fs.readFileSync(SYSTEM_SCREENS, 'utf8');

const EXPECTED_ADMIN_MENU = [
  { href: '#/painel',                  label: 'Painel' },
  { href: '#/ops',                     label: 'OPs' },
  { href: '#/pedidos',                 label: 'Pedidos' },
  { href: '#/ordens-compra',           label: 'Ordens de compra' },
  { href: '#/documentos/recebidos',    label: 'Documentos' },
  { href: '#/cadastros/cores',         label: 'Cores' },
  { href: '#/cadastros/modelos',       label: 'Modelos' },
  { href: '#/cadastros/parametros',    label: 'Parâmetros' },
  { href: '#/cadastros/fornecedores',  label: 'Fornecedores' },
  { href: '#/cadastros/clientes',      label: 'Clientes' },
  { href: '#/cadastros/precos',        label: 'Preços' },
  { href: '#/cadastros/usuarios',      label: 'Usuários' },
];

// -----------------------------------------------------------------------------
// Helpers de validação estática
// -----------------------------------------------------------------------------

function extractInlineScript(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const matches = [];
  let m;
  while ((m = re.exec(html)) !== null) matches.push(m[1]);
  if (matches.length === 0) throw new Error('nenhum <script> inline encontrado');
  return matches.reduce((a, b) => (a.length >= b.length ? a : b));
}

function findScriptIdx(html, src) {
  const re = new RegExp(`<script\\s+src="${src.replace(/\//g, '\\/')}"\\s*></script>`);
  const m = re.exec(html);
  return m ? m.index : -1;
}

function firstInlineScriptIndex(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>/g;
  const m = re.exec(html);
  return m ? m.index : -1;
}

// -----------------------------------------------------------------------------
// Helper de runtime: FakeNode (DOM mínimo) + document mock, carrega js/ui.js
// (el real) e js/screens/common.js num vm.Context isolado.
// -----------------------------------------------------------------------------

class FakeNode {
  constructor(t) {
    this.tagName = (t + '').toUpperCase();
    this.children = [];
    this.className = '';
    this._text = null;
    this._listeners = {};
    // Pass-7 (§14.1) DOM fidelity: every real element exposes `.style`.
    this.style = {};
    this.disabled = false;
    this.value = '';
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this['_attr_' + k] = v; }
  // Pass-7 (§14.1) DOM fidelity: every real element exposes these.
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this, '_attr_' + k) ? this['_attr_' + k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this, '_attr_' + k); }
  removeAttribute(k) { delete this['_attr_' + k]; }
  addEventListener(type, fn) { this._listeners[type] = fn; }
  removeEventListener(type) { delete this._listeners[type]; }
  replaceChildren() { this.children = []; }
  remove() { this._removed = true; }
  get textContent() { return this._text != null ? this._text : ''; }
  set textContent(v) { this._text = v; }
}

function findAll(node, pred, out) {
  out = out || [];
  if (pred(node)) out.push(node);
  for (const c of node.children || []) findAll(c, pred, out);
  return out;
}

// el() do ui.js anexa texto como filho via document.createTextNode(), não via
// a propriedade textContent do próprio nó — por isso precisa descer na árvore.
function textOf(node) {
  if (node && node.children && node.children.length) {
    return node.children.map(textOf).join('');
  }
  return (node && node.textContent) || '';
}

function makeCommonSandbox(currentUser) {
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: () => new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const calls = { logout: 0 };
  const sandbox = {
    document, console, setTimeout, clearTimeout, URL, URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // js/ui.js fornece el() real.
  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc, sandbox, { filename: 'js/ui.js' });

  // Stubs que normalmente vêm de js/auth.js, presentes antes de carregar common.js.
  sandbox.CURRENT_USER = currentUser || null;
  sandbox.logout = () => { calls.logout++; };

  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  return { sandbox, calls };
}

// -----------------------------------------------------------------------------
// 1. Validações estáticas
// -----------------------------------------------------------------------------

test('1-2. js/screens/common.js existe e é script clássico (não ES module)', () => {
  assert.ok(fs.existsSync(COMMON), 'js/screens/common.js não existe');
  assert.equal(/^\s*export\s+/m.test(commonSrc), false,
    'common.js parece usar export — deve ser script clássico');
  assert.equal(/import\s+.*\s+from\s+/.test(commonSrc), false,
    'common.js parece usar import — deve ser script clássico');
});

test('3. common.js: sintaxe JS válida (node --check)', () => {
  const { execSync } = require('node:child_process');
  const out = execSync(`node --check "${COMMON}"`, { stdio: 'pipe' });
  assert.equal(out.length >= 0, true);
});

test('4. index.html carrega js/screens/common.js EXATAMENTE UMA VEZ, sem type=module', () => {
  // Todos os assets locais de index.html carregam com cache-token `?v=...`;
  // a contagem precisa enxergar a tag com o token.
  assert.equal(appSource.countScriptTags(indexSrc, 'js/screens/common.js'), 1,
    'esperado exatamente 1 <script src="js/screens/common.js">');
  assert.equal(/<script[^>]*src="js\/screens\/common\.js[^"]*"[^>]*type=/.test(indexSrc), false,
    'common.js está sendo carregado com type=module — deve ser script clássico');
});

test('5. index.html: ordem router → system-screens → common → boot', () => {
  const routerIdx = appSource.scriptIndex(indexSrc, 'js/router.js');
  const sysIdx    = appSource.scriptIndex(indexSrc, 'js/screens/system-screens.js');
  const commonIdx = appSource.scriptIndex(indexSrc, 'js/screens/common.js');
  const bootIdx   = appSource.bootScriptIndex(indexSrc);
  assert.ok(routerIdx > 0, 'js/router.js não encontrado');
  assert.ok(sysIdx > 0, 'js/screens/system-screens.js não encontrado');
  assert.ok(commonIdx > 0, 'js/screens/common.js não encontrado');
  assert.ok(bootIdx > 0, 'js/boot.js (entrypoint, sucessor do inline) não encontrado');
  assert.ok(routerIdx < commonIdx, 'router antes de common');
  assert.ok(sysIdx < commonIdx, 'system-screens antes de common');
  assert.ok(commonIdx < bootIdx, 'common antes do boot');
  // O boot continua sendo o ÚLTIMO script local — se deixar de ser, ele
  // passa a rodar antes de módulos que o setRoutes referencia.
  assert.equal(indexSrc.indexOf('<script src="js/', bootIdx + 1), -1,
    'js/boot.js deve ser o último script local de index.html');
});

test('6. o boot NÃO contém mais function shellLayout nem const ADMIN_MENU', () => {
  assert.equal(/function\s+shellLayout\s*\(/.test(bootSrc), false,
    'boot ainda declara function shellLayout');
  assert.equal(/const\s+ADMIN_MENU\s*=/.test(bootSrc), false,
    'boot ainda declara const ADMIN_MENU');
});

test('7. o boot ainda contém main + setRoutes; as telas viraram módulos próprios', () => {
  assert.match(bootSrc, /function\s+main\s*\(/);
  assert.match(bootSrc, /window\.RAVATEX_ROUTER\.setRoutes\(/);
  // As telas saíram do inline para módulos dedicados; o boot passou a
  // REFERENCIÁ-LAS pelo namespace global em vez de declará-las.
  assert.match(painelSrc, /function\s+screenPainel\s*\(/,
    'screenPainel deve ser declarada em js/screens/painel.js');
  assert.match(opNovaSrc, /function\s+screenNovaOP\s*\(/,
    'screenNovaOP deve ser declarada em js/screens/op-nova.js');
  assert.match(bootSrc, /render:\s*window\.screenPainel/,
    'o boot deve registrar a rota do painel pelo global window.screenPainel');
  assert.equal(/function\s+screenPainel\s*\(/.test(bootSrc), false,
    'o boot não pode voltar a declarar telas');
});

test('8. o chamador do shell usa shellLayout(ADMIN_MENU) pelo namespace global', () => {
  // Enquanto tudo era um único inline, `shellLayout`/`ADMIN_MENU` eram
  // identificadores bare do mesmo escopo. Com a extração em módulos
  // clássicos independentes, cada um roda no seu próprio IIFE — o acesso
  // PRECISA ser pelo global. O contrato preservado é o que importa: o
  // painel renderiza pelo shell compartilhado, com o menu admin canônico.
  assert.match(painelSrc, /window\.shellLayout\(\s*window\.ADMIN_MENU\s*,/,
    'painel.js deve renderizar via shellLayout com o ADMIN_MENU canônico');
  assert.equal(/const\s+ADMIN_MENU\s*=/.test(painelSrc), false,
    'painel.js não pode declarar seu próprio ADMIN_MENU');
});

test('9-10. js/screens/common.js não contém chamadas Supabase nem createClient', () => {
  assert.equal(/supa\.from\s*\(/.test(commonSrc), false, 'supa.from( encontrado');
  assert.equal(/\.insert\s*\(/.test(commonSrc), false, '.insert( encontrado');
  assert.equal(/\.update\s*\(/.test(commonSrc), false, '.update( encontrado');
  assert.equal(/\.delete\s*\(/.test(commonSrc), false, '.delete( encontrado');
  assert.equal(/\.rpc\s*\(/.test(commonSrc), false, '.rpc( encontrado');
  assert.equal(/createClient\s*\(/.test(commonSrc), false, 'createClient( encontrado');
});

test('11-12. common.js: nenhum service_role nem password literal', () => {
  assert.equal(/service_role/i.test(commonSrc), false, 'service_role em common.js');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(commonSrc), false,
    'password literal longo em common.js');
});

test('13. index.html: nenhum service_role nem password literal (preservado)', () => {
  assert.equal(/service_role/i.test(indexSrc), false, 'service_role em index.html');
  assert.equal(/password\s*[:=]\s*['"][A-Za-z0-9._-]{20,}['"]/.test(indexSrc), false,
    'password literal longo em index.html');
});

test('14. ADMIN_MENU é declarado uma única vez no projeto (js/screens/common.js)', () => {
  // Varre o projeto inteiro em vez de só common.js + inline: agora que as
  // telas são módulos, uma redeclaração poderia aparecer em qualquer um.
  const dir = path.join(ROOT, 'js');
  const arquivos = [];
  (function walk(d) {
    for (const nome of fs.readdirSync(d)) {
      const p = path.join(d, nome);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (nome.endsWith('.js')) arquivos.push(p);
    }
  })(dir);
  const declarantes = arquivos.filter((p) =>
    /const\s+ADMIN_MENU\s*=/.test(appSource.readSource(p)));
  assert.deepEqual(
    declarantes.map((p) => path.relative(ROOT, p).replace(/\\/g, '/')),
    ['js/screens/common.js'],
    'ADMIN_MENU deve ser declarado exatamente uma vez, em js/screens/common.js'
  );
});

// -----------------------------------------------------------------------------
// INTTEX-BRAND-ASSET-INTEGRATION — a marca da topbar deixa de ser texto.
//
// O chrome visual de shellLayout() só é montado quando visualCapable() é
// verdadeiro, e o FakeNode deste arquivo não expõe innerHTML — o runtime aqui
// cai, por contrato, no fallback estrutural, que mantém o texto acessível que
// os testes 21-23 asseguram. A troca da marca é portanto provada na FONTE, que
// é onde ela vive.
// -----------------------------------------------------------------------------

test('BRAND/1. a topbar consome arte de marca aprovada, não mais texto', () => {
  // Exatamente duas formas, cada uma declarada uma única vez, e nenhuma outra.
  assert.equal(commonSrc.split("'assets/brand/inttex/inttex-logo.svg'").length - 1, 1,
    'o logotipo horizontal deve ser declarado exatamente uma vez');
  assert.equal(commonSrc.split("'assets/brand/inttex/inttex-symbol.svg'").length - 1, 1,
    'o símbolo deve ser declarado exatamente uma vez');
  const outras = commonSrc.match(/assets\/brand\/inttex\/[a-z-]+\.svg/g) || [];
  assert.deepEqual([...new Set(outras)].sort(),
    ['assets/brand/inttex/inttex-logo.svg', 'assets/brand/inttex/inttex-symbol.svg'],
    'nenhuma outra variante de marca pode ser consumida pela topbar');
  // A marca é um <img> real com nome acessível, e não um glifo desenhado por
  // CSS. O <source> só troca a ARTE; o dono do nome acessível e da geometria
  // continua sendo o <img>, que carrega a forma primária.
  assert.match(commonSrc, /window\.el\('img',\s*\{\s*src: BRAND_LOGO,\s*alt: 'Inttex',/,
    'o <img> da topbar deve carregar a forma primária e o nome acessível');
  assert.match(commonSrc, /window\.el\('source',\s*\{ media: BRAND_NARROW_QUERY, srcset: BRAND_SYMBOL \}\)/,
    'a forma estreita deve ser declarada por <source media>');
  // O <span> de marca somente-texto saiu do chrome visual.
  assert.equal(/\}, 'Inttex'\),/.test(commonSrc), false,
    'o wordmark textual da topbar ainda está sendo renderizado');
});

test('BRAND/2. a marca preserva proporção e não é distorcida nem decorada', () => {
  const m = commonSrc.match(/alt: 'Inttex',\s*style: '([^']+)'/);
  assert.ok(m, 'estilo da marca da topbar não encontrado');
  const style = m[1];
  // Altura declarada, largura SEMPRE derivada: as duas formas preservam a
  // proporção nativa do próprio viewBox (194.57x31.56 e 88.08x88.08).
  assert.match(style, /height:20px/);
  assert.match(style, /width:auto/);
  assert.equal(/width:\s*\d/.test(style), false, 'a largura nunca pode ser fixada');
  // A barra não pode espremer a arte ao apertar: quem segura é o <picture>.
  const wrap = commonSrc.match(/'data-rv-brand': '',\s*style: '([^']+)'/);
  assert.ok(wrap, 'estilo do <picture> da marca não encontrado');
  assert.match(wrap[1], /flex-shrink:0/);
  // Nem distorcer, nem recolorir, nem aplicar efeito.
  for (const proibido of ['box-shadow', 'filter', 'border', 'transform', 'opacity']) {
    assert.equal(style.includes(proibido), false, `a marca não pode declarar ${proibido}`);
    assert.equal(wrap[1].includes(proibido), false, `o <picture> não pode declarar ${proibido}`);
  }
});

// A forma estreita existe porque foi MEDIDA como necessária, não por gosto: em
// 390px o conjunto excede a largura útil e o rótulo de secão colidiria com o
// sino. O guard fixa o breakpoint no MESMO 767px que css/responsive.css possui,
// para que as duas fontes não possam divergir em silêncio, e prova que a
// escolha é derivada — nunca uma folha de estilo nova.
test('BRAND/5. a forma estreita usa o símbolo aprovado no breakpoint do shell', () => {
  assert.match(commonSrc, /var BRAND_NARROW_QUERY = '\(max-width: 767px\)';/,
    'a troca de forma deve usar o breakpoint de 767px do shell');
  assert.match(responsiveCss, /@media \(max-width: 767px\)/,
    'css/responsive.css deve continuar a possuir o mesmo breakpoint');
  // O wordmark é a forma PRIMÁRIA: é ele que está no <img>. O símbolo só entra
  // pelo <source media>, isto é, apenas abaixo do breakpoint.
  assert.match(commonSrc, /var BRAND_LOGO = 'assets\/brand\/inttex\/inttex-logo\.svg';/);
  assert.match(commonSrc, /var BRAND_SYMBOL = 'assets\/brand\/inttex\/inttex-symbol\.svg';/);
  assert.ok(commonSrc.indexOf('srcset: BRAND_SYMBOL') < commonSrc.indexOf('src: BRAND_LOGO'),
    'o <source> tem de preceder o <img> para que o browser possa escolher');
  // A escolha é do browser: nenhum listener de resize, nenhum matchMedia,
  // nenhum estado a sincronizar — logo, nada que possa vazar ou dessincronizar.
  for (const mecanismo of ['matchMedia', "addEventListener('resize'", 'ResizeObserver']) {
    assert.equal(commonSrc.includes(mecanismo), false,
      `a troca de forma da marca não pode depender de ${mecanismo}`);
  }
  // E nenhuma folha de estilo foi tocada por esta ordem.
  const { execFileSync } = require('node:child_process');
  for (const rel of ['css/responsive.css', 'css/tokens.css']) {
    const committed = execFileSync('git', ['rev-parse', 'HEAD:' + rel],
      { cwd: ROOT, encoding: 'utf8' }).trim();
    const worktree = execFileSync('git', ['hash-object', '--', rel],
      { cwd: ROOT, encoding: 'utf8' }).trim();
    assert.equal(worktree, committed, rel + ' foi alterado — nenhuma folha de estilo pertence a esta ordem');
  }
});

test('BRAND/3. a geometria da topbar e a faixa de clear-space seguem intactas', () => {
  // Altura da topbar, divisor, rótulo de seção e área do usuário preservados.
  assert.match(commonSrc, /height:62px;flex-shrink:0;/, 'a topbar mudou de altura');
  assert.match(commonSrc, /display:flex;align-items:center;gap:14px;/,
    'o gap de 14px entre marca e divisor é a faixa de clear-space da marca');
  assert.match(commonSrc, /width:1px;height:20px;background:var\(--rv-surface-subtle\)/,
    'o divisor de seção sumiu da topbar');
  assert.match(commonSrc, /\}, sectionLabel\)/, 'o rótulo de seção sumiu da topbar');
  assert.match(commonSrc, /padding:0 28px;border-bottom:1px solid var\(--rv-border\)/,
    'o padding do header mudou');
  // Os três rótulos de seção por perfil continuam os mesmos.
  assert.match(commonSrc, /if \(tipo === 'cliente'\) return 'Portal do cliente';/);
  assert.match(commonSrc, /if \(tipo === 'fornecedor'\) return 'Fornecedor';/);
  assert.match(commonSrc, /return 'Admin';/);
});

test('BRAND/4. index.html carrega common.js e system-screens.js sob o token da ordem de marca', () => {
  const TOKEN = '20260727-inttex-brand-integration';
  for (const rel of ['js/screens/common.js', 'js/screens/system-screens.js']) {
    assert.ok(indexSrc.includes(`"${rel}?v=${TOKEN}"`),
      `${rel} deve carregar o token da integração de marca`);
    assert.equal(indexSrc.includes(`"${rel}?v=20260727-ui-specialized-controls-b1"`), false,
      `${rel} não pode reter o token superseded de SPECIALIZED-CONTROLS-B1`);
  }
  // O token não vaza para nenhum asset que esta ordem não alterou.
  const carriers = (indexSrc.match(new RegExp(`(?:src|href)="([^"]+)\\?v=${TOKEN}"`, 'g')) || [])
    .map((s) => s.replace(/^(?:src|href)="/, '').replace(/\?v=.*$/, ''));
  assert.deepEqual(carriers.slice().sort(),
    ['js/screens/common.js', 'js/screens/system-screens.js'],
    'exatamente os dois assets alterados podem carregar o token da ordem');
});

// -----------------------------------------------------------------------------
// 2. Validação de runtime
// -----------------------------------------------------------------------------

test('15-17. runtime: window.RAVATEX_SCREENS.common existe e expõe ADMIN_MENU + shellLayout', () => {
  const { sandbox } = makeCommonSandbox();
  const common = vm.runInContext('window.RAVATEX_SCREENS.common', sandbox);
  assert.ok(common && typeof common === 'object', 'RAVATEX_SCREENS.common não é objeto');
  assert.ok(Array.isArray(common.ADMIN_MENU), 'RAVATEX_SCREENS.common.ADMIN_MENU não é array');
  assert.equal(typeof common.shellLayout, 'function', 'RAVATEX_SCREENS.common.shellLayout não é função');
});

test('18. runtime: globais legados window.ADMIN_MENU e window.shellLayout existem', () => {
  const { sandbox } = makeCommonSandbox();
  assert.ok(Array.isArray(vm.runInContext('window.ADMIN_MENU', sandbox)), 'window.ADMIN_MENU ausente');
  assert.equal(typeof vm.runInContext('window.shellLayout', sandbox), 'function', 'window.shellLayout ausente');
});

test('19. runtime: ADMIN_MENU tem exatamente os itens esperados, na ordem original', () => {
  const { sandbox } = makeCommonSandbox();
  const menu = vm.runInContext('window.ADMIN_MENU', sandbox);
  // Serializa para sair do realm da vm (objetos cross-realm não são
  // deepStrictEqual mesmo com mesma estrutura).
  assert.deepEqual(JSON.parse(JSON.stringify(menu)), EXPECTED_ADMIN_MENU);
});

test('20. runtime: shellLayout é função', () => {
  const { sandbox } = makeCommonSandbox();
  assert.equal(typeof vm.runInContext('window.shellLayout', sandbox), 'function');
});

test('21. runtime: shellLayout(menuItems, contentNode) retorna nó renderizável (header + aside + main)', () => {
  const { sandbox } = makeCommonSandbox({ nome: 'Ana', tipo: 'admin' });
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([{ href: "#/x", label: "X" }], contentNode)', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'shellLayout não retornou um <div>');
  const header = root.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'header ausente');
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  assert.ok(flexDiv, 'div flex (aside+main) ausente');
  const aside = flexDiv.children.find((c) => c.tagName === 'ASIDE');
  const main  = flexDiv.children.find((c) => c.tagName === 'MAIN');
  assert.ok(aside, 'aside ausente');
  assert.ok(main, 'main ausente');
});

test('22. runtime: shellLayout renderiza um <a> por item de menuItems, com href/label corretos', () => {
  const { sandbox } = makeCommonSandbox();
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const items = [{ href: '#/a', label: 'Aaa' }, { href: '#/b', label: 'Bbb' }];
  sandbox.items = items;
  const root = vm.runInContext('window.shellLayout(items, contentNode)', sandbox);
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const aside = flexDiv.children.find((c) => c.tagName === 'ASIDE');
  const links = aside.children.filter((c) => c.tagName === 'A');
  assert.equal(links.length, 2, 'número de <a> não corresponde ao número de itens');
  assert.equal(links[0]._attr_href, '#/a');
  assert.equal(textOf(links[0]), 'Aaa');
  assert.equal(links[1]._attr_href, '#/b');
  assert.equal(textOf(links[1]), 'Bbb');
});

test('23. runtime: shellLayout(ADMIN_MENU, content) renderiza os 9 itens do ADMIN_MENU', () => {
  const { sandbox } = makeCommonSandbox();
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout(window.ADMIN_MENU, contentNode)', sandbox);
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const aside = flexDiv.children.find((c) => c.tagName === 'ASIDE');
  const links = aside.children.filter((c) => c.tagName === 'A');
  assert.equal(links.length, EXPECTED_ADMIN_MENU.length);
});

test('24. runtime: shellLayout inclui o nome do CURRENT_USER no header quando definido', () => {
  const { sandbox } = makeCommonSandbox({ nome: 'Carlos', tipo: 'admin' });
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([], contentNode)', sandbox);
  const header = root.children.find((c) => c.tagName === 'HEADER');
  const span = findAll(header, (n) => n.tagName === 'SPAN')[0];
  assert.ok(span, 'span do usuário ausente no header');
  assert.equal(textOf(span), 'Carlos (admin)');
});

test('25-26. runtime: shellLayout inclui botão "Sair" com onclick === window.logout, e clique aciona logout', () => {
  const { sandbox, calls } = makeCommonSandbox({ nome: 'Dora', tipo: 'fornecedor' });
  const contentNode = new FakeNode('div');
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([], contentNode)', sandbox);
  const header = root.children.find((c) => c.tagName === 'HEADER');
  const btn = findAll(header, (n) => n.tagName === 'BUTTON')[0];
  assert.ok(btn, 'botão Sair ausente no header');
  assert.equal(textOf(btn), 'Sair');
  btn._listeners.click();
  assert.equal(calls.logout, 1, 'clique no botão Sair não acionou window.logout');
});

test('27. runtime: shellLayout(menuItems, contentNode) insere o contentNode dentro do <main>', () => {
  const { sandbox } = makeCommonSandbox();
  const contentNode = new FakeNode('div');
  contentNode._marker = 'meu-conteudo';
  sandbox.contentNode = contentNode;
  const root = vm.runInContext('window.shellLayout([], contentNode)', sandbox);
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const main = flexDiv.children.find((c) => c.tagName === 'MAIN');
  assert.ok(main.children.some((c) => c._marker === 'meu-conteudo'),
    'contentNode não foi inserido dentro do <main>');
});

// -----------------------------------------------------------------------------
// 3. Integração: screenPainel() do inline ainda renderiza via shellLayout
// -----------------------------------------------------------------------------

test('28. integração: screenPainel() (painel.js) ainda renderiza via shellLayout num boot completo', () => {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });

  // Stubs necessários (CURRENT_USER/logout vêm de auth.js no boot real).
  sandbox.CURRENT_USER = { nome: 'Eva', tipo: 'admin' };
  sandbox.logout = () => {};

  // A tela saiu do inline para o seu módulo dedicado.
  vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });

  const root = vm.runInContext('window.screenPainel()', sandbox);
  assert.ok(root && root.tagName === 'DIV', 'screenPainel não retornou um <div>');
  const header = root.children.find((c) => c.tagName === 'HEADER');
  assert.ok(header, 'screenPainel não passou por shellLayout (header ausente)');
  const flexDiv = root.children.find((c) => c.tagName === 'DIV');
  const aside = flexDiv && flexDiv.children.find((c) => c.tagName === 'ASIDE');
  assert.ok(aside, 'aside (menu admin) ausente em screenPainel via shellLayout');
  const links = aside.children.filter((c) => c.tagName === 'A');
  assert.equal(links.length, EXPECTED_ADMIN_MENU.length,
    'screenPainel não renderizou o ADMIN_MENU completo via shellLayout');
});

// -----------------------------------------------------------------------------
// 4. Boot: ui.js + badges.js + router.js + system-screens.js + common.js + inline coexistem
// -----------------------------------------------------------------------------

test('30. boot: ui.js + badges.js + router.js + system-screens.js + common.js + painel.js + boot.js coexistem sem SyntaxError de duplicate identifier', () => {
  const toastsNode = new FakeNode('div');
  const document = {
    createElement: (t) => new FakeNode(t),
    createTextNode: (t) => ({ textContent: t, appendChild() {}, setAttribute() {} }),
    querySelector: (sel) => (sel === '#toasts') ? toastsNode : new FakeNode('div'),
    querySelectorAll: () => [],
    addEventListener: () => {}, removeEventListener: () => {},
    body: new FakeNode('body'),
  };
  const sandbox = {
    document, setTimeout, clearTimeout, console, URL, URLSearchParams,
    location: { hash: '' },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Pass-7: js/ui.js::selectInput() delegates to the canonical select
  // popover, so the owner must exist in the sandbox before ui.js runs.
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js', 'select-popover.js'), 'utf8'), sandbox, { filename: 'js/select-popover.js' });
  vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
  vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });
  vm.runInContext(routerSrc, sandbox, { filename: 'js/router.js' });
  vm.runInContext(sysSrc,    sandbox, { filename: 'js/screens/system-screens.js' });
  vm.runInContext(commonSrc, sandbox, { filename: 'js/screens/common.js' });
  vm.runInContext(cadSrc,    sandbox, { filename: 'js/screens/cadastros.js' });
  vm.runInContext(opsSrc,    sandbox, { filename: 'js/screens/ops-list.js' });
  vm.runInContext(efSrc,     sandbox, { filename: 'js/screens/entrega-form.js' });
  vm.runInContext(ewSrc,     sandbox, { filename: 'js/screens/entrega-writes.js' });
  vm.runInContext(fornSrc,   sandbox, { filename: 'js/screens/fornecedor.js' });

  let threwSyntax = false;
  let otherErr = null;
  try {
    vm.runInContext(painelSrc, sandbox, { filename: 'js/screens/painel.js' });
    vm.runInContext(bootSrc, sandbox, { filename: 'js/boot.js' });
  } catch (e) {
    if (e instanceof SyntaxError && /already been declared|Identifier .* has already/.test(e.message)) {
      threwSyntax = true;
    } else {
      otherErr = e;
    }
  }
  assert.equal(threwSyntax, false,
    'coexistência common.js + inline lançou SyntaxError de duplicate identifier');

  const routes = vm.runInContext('window.routes', sandbox);
  assert.ok(routes && routes['#/painel'], 'setRoutes do inline não registrou #/painel');

  if (otherErr) {
    console.log('(esperado) inline falhou em runtime fora do duplicate-identifier:', String(otherErr.message).slice(0, 120));
  }
});
