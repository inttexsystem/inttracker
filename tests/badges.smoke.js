// Smoke test do módulo js/badges.js.
//
// Cobre o risco residual real da extração D2C: depois de mover helpers
// de badge para um arquivo carregado via <script src=...> separado, é
// possível quebrar o app de formas que testes unitários clássicos não
// pegam:
//
//   1. O binding precisa estar acessível a OUTROS <script> da página
//      (binding cross-script). No browser, <script> clássicos compartilham
//      o mesmo "Script Record" — const/let ficam no escopo, function/var
//      viram window.*. Aqui em vm isso equivale a carregar os arquivos no
//      MESMO contexto.
//
//   2. A ordem dos <script> em index.html precisa satisfazer a dependência:
//      js/ui.js (define el) → js/badges.js (consome el). Quebrar a ordem
//      daria ReferenceError no browser.
//
//   3. O shape do nó retornado e os valores dos labels/classes precisam
//      ser preservados (a extração é literal — não pode mudar UI).

'use strict';

const test   = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('node:fs');
const path   = require('node:path');
const vm     = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const uiSrc     = fs.readFileSync(path.join(ROOT, 'js', 'ui.js'),     'utf8');
const badgesSrc = fs.readFileSync(path.join(ROOT, 'js', 'badges.js'), 'utf8');

// ---- DOM mock mínimo ----
class FakeNode {
  constructor(tag) {
    this.tagName = (tag + '').toUpperCase();
    this.children = [];
    this._attrs = {};
    this._text = null;
    this.className = '';
  }
  appendChild(n) { this.children.push(n); return n; }
  setAttribute(k, v) { this._attrs[k] = v; if (k === 'class') this.className = v; }
  addEventListener() {}
  removeEventListener() {}
  replaceChildren(...nodes) {
    this.children = [];
    for (const n of nodes.flat()) {
      if (n == null || n === false) continue;
      this.children.push(typeof n === 'string' ? new FakeText(n) : n);
    }
  }
  get textContent() {
    if (this._text != null) return this._text;
    return this.children.map(c => c.textContent).join('');
  }
  set textContent(v) { this._text = v; this.children = []; }
}
class FakeText extends FakeNode {
  constructor(t) { super('#text'); this._text = t; }
}
const fakeDocument = {
  createElement:     (t) => new FakeNode(t),
  createTextNode:    (t) => new FakeText(t),
  querySelector:     () => null,
  querySelectorAll:  () => [],
  addEventListener:  () => {},
  removeEventListener: () => {},
  body: new FakeNode('body'),
};

const sandbox = { document: fakeDocument, setTimeout, clearTimeout, console };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// Carrega os dois scripts no MESMO contexto, na ordem do <head> de
// index.html. Esta ordem é parte do contrato testado.
vm.runInContext(uiSrc,     sandbox, { filename: 'js/ui.js' });
vm.runInContext(badgesSrc, sandbox, { filename: 'js/badges.js' });

// Lê os bindings como se fôssemos OUTRO <script> da mesma página: por
// resolução de nome, não por window.x.
function readBinding(name) {
  return vm.runInContext(
    `typeof ${name} === "undefined" ? undefined : ${name}`,
    sandbox,
    { filename: 'inline-other-script' }
  );
}

test('bindings cross-script (mesmo Script Record)', () => {
  assert.equal(typeof readBinding('el'),          'function');
  assert.equal(typeof readBinding('badgeTipo'),   'function');
  assert.equal(typeof readBinding('badgeStatus'), 'function');
});

test('mapas expostos via escopo compartilhado', () => {
  const labels = readBinding('OP_STATUS_LABEL');
  const badge  = readBinding('OP_STATUS_BADGE');
  const tipoL  = readBinding('OP_TIPO_LABEL');
  const tipoB  = readBinding('OP_TIPO_BADGE');
  assert.equal(typeof labels, 'object');
  assert.equal(typeof badge,  'object');
  assert.equal(typeof tipoL,  'object');
  assert.equal(typeof tipoB,  'object');
  assert.notEqual(labels, null);
  assert.notEqual(badge,  null);
  assert.notEqual(tipoL,  null);
  assert.notEqual(tipoB,  null);
});

test('OP_STATUS_LABEL tem os labels esperados', () => {
  const labels = readBinding('OP_STATUS_LABEL');
  assert.equal(labels.simulada,    'Simulada');
  assert.equal(labels.aberta,      'Aberta');
  assert.equal(labels.em_producao, 'Em produção');
  assert.equal(labels.finalizada,  'Finalizada');
});

test('OP_TIPO_LABEL tem os labels esperados', () => {
  const tipoL = readBinding('OP_TIPO_LABEL');
  assert.equal(tipoL.tecelagem, 'Tecelagem');
  assert.equal(tipoL.latex,     'Látex');
});

test('OP_STATUS_BADGE tem classes Tailwind para cada status', () => {
  const badge = readBinding('OP_STATUS_BADGE');
  assert.match(badge.simulada,    /bg-gray-100/);
  assert.match(badge.aberta,      /bg-blue-100/);
  assert.match(badge.em_producao, /bg-amber-100/);
  assert.match(badge.finalizada,  /bg-green-100/);
});

test('OP_TIPO_BADGE tem classes Tailwind para cada tipo', () => {
  const tipoB = readBinding('OP_TIPO_BADGE');
  assert.match(tipoB.tecelagem, /bg-indigo-100/);
  assert.match(tipoB.latex,     /bg-amber-100/);
});

// ---------------------------------------------------------------------
// A4 — badgeStatus / badgeTipo delegate to the canonical badge owner.
//
// These helpers used to build their own <span> from a local Tailwind
// family map (OP_STATUS_BADGE / OP_TIPO_BADGE) at ordinary 4px geometry.
// They are semantic badges, so they now delegate to rvStatusPill and
// rvClassificationBadge and the canonical owner decides family, geometry
// and dot. The maps survive for their compatibility consumers (asserted
// above) but no longer reach rendering.
//
// What these tests assert changed FORM, not guarantee: the label, the
// SPAN shape and the unknown-value fallback are still pinned exactly;
// the family is now read from the canonical --rv-pill-<family>-* token
// instead of from a Tailwind class name.
// ---------------------------------------------------------------------

/** The canonical family a rendered badge resolved to, or null. */
function familyOf(span) {
  const style = String((span && span._attrs && span._attrs.style) || '');
  const m = style.match(/var\(--rv-pill-([a-z]+)-bg\)/);
  return m ? m[1] : null;
}
/** The 5px status dots a rendered badge carries. */
function dotsOf(span) {
  return (span && span.children ? span.children : []).filter((c) => {
    const s = String((c && c._attrs && c._attrs.style) || '');
    return s.includes('width:5px') && s.includes('height:5px');
  });
}
/** Every badge is a canonical pill, never ordinary geometry. */
function assertCanonicalPill(span, label) {
  const style = String(span._attrs.style || '');
  assert.equal(span.tagName, 'SPAN', label + ': tagName');
  assert.match(style, /border-radius:var\(--rv-radius-pill\)/, label + ': deve usar o raio canonico de pill');
  assert.doesNotMatch(style, /border-radius:var\(--rv-radius\);/, label + ': nao pode voltar a geometria ordinaria');
  assert.match(style, /height:18px/, label + ': deve usar a altura canonica de 18px');
  assert.equal(span.className, '', label + ': nao pode carregar classe Tailwind de familia');
}

test('badgeStatus("em_producao") e uma pill de status caution com label correto', () => {
  const span = vm.runInContext("badgeStatus('em_producao')", sandbox, { filename: 'inline-render' });
  assert.ok(span instanceof FakeNode);
  assertCanonicalPill(span, 'badgeStatus("em_producao")');
  assert.equal(familyOf(span), 'caution');
  assert.equal(dotsOf(span).length, 1, 'um status de ciclo de vida carrega exatamente um ponto de 5px');
  assert.equal(span.textContent, 'Em produção');
});

test('badgeStatus("finalizada") e uma pill positive com label "Finalizada"', () => {
  const span = vm.runInContext("badgeStatus('finalizada')", sandbox, { filename: 'inline-render' });
  assertCanonicalPill(span, 'badgeStatus("finalizada")');
  assert.equal(familyOf(span), 'positive');
  assert.equal(dotsOf(span).length, 1);
  assert.equal(span.textContent, 'Finalizada');
});

test('badgeStatus("simulada") e uma pill neutral com label "Simulada"', () => {
  const span = vm.runInContext("badgeStatus('simulada')", sandbox, { filename: 'inline-render' });
  assertCanonicalPill(span, 'badgeStatus("simulada")');
  assert.equal(familyOf(span), 'neutral');
  assert.equal(dotsOf(span).length, 1);
  assert.equal(span.textContent, 'Simulada');
});

test('badgeStatus("aberta") e uma pill info com label "Aberta"', () => {
  const span = vm.runInContext("badgeStatus('aberta')", sandbox, { filename: 'inline-render' });
  assertCanonicalPill(span, 'badgeStatus("aberta")');
  assert.equal(familyOf(span), 'info');
  assert.equal(dotsOf(span).length, 1);
  assert.equal(span.textContent, 'Aberta');
});

test('badgeStatus cai no fallback neutral para status desconhecido', () => {
  // A garantia original ("desconhecido nao ganha tratamento semantico") e a
  // mesma; o fallback agora e a familia neutral e nao a classe cinza.
  const span = vm.runInContext("badgeStatus('xyz')", sandbox, { filename: 'inline-render' });
  assertCanonicalPill(span, 'badgeStatus("xyz")');
  assert.equal(familyOf(span), 'neutral');
  assert.equal(span.textContent, 'xyz');
});

test('badgeTipo("latex") e um badge de classificacao neutral, sem ponto, com label "Látex"', () => {
  const span = vm.runInContext("badgeTipo('latex')", sandbox, { filename: 'inline-render' });
  assertCanonicalPill(span, 'badgeTipo("latex")');
  assert.equal(familyOf(span), 'neutral', 'tipo de OP e classificacao, nao estado semantico');
  assert.equal(dotsOf(span).length, 0, 'uma classificacao nao carrega ponto de status');
  assert.doesNotMatch(String(span._attrs.style), /--rv-stage-/, 'Látex nao e o estagio acabamento do contrato');
  assert.equal(span.textContent, 'Látex');
});

test('badgeTipo("tecelagem") e um badge de classificacao neutral, sem ponto', () => {
  const span = vm.runInContext("badgeTipo('tecelagem')", sandbox, { filename: 'inline-render' });
  assertCanonicalPill(span, 'badgeTipo("tecelagem")');
  assert.equal(familyOf(span), 'neutral');
  assert.equal(dotsOf(span).length, 0);
  assert.equal(span.textContent, 'Tecelagem');
});

test('badgeTipo cai no fallback neutral para tipo desconhecido', () => {
  const span = vm.runInContext("badgeTipo('xyz')", sandbox, { filename: 'inline-render' });
  assertCanonicalPill(span, 'badgeTipo("xyz")');
  assert.equal(familyOf(span), 'neutral');
  assert.equal(span.textContent, 'xyz');
});

test('todos os badges retornados tem a forma <span style="…">texto</span> esperada pelo DOM', () => {
  // O call-site renderiza o no retornado direto no DOM. A forma exigida
  // continua sendo um SPAN com texto nao-vazio; o portador do estilo passou
  // de `class` para `style`, porque a geometria e a familia agora vem do
  // dono canonico e nao de utilitarios Tailwind.
  for (const input of ['em_producao', 'finalizada', 'simulada', 'aberta', 'xyz']) {
    const span = vm.runInContext(`badgeStatus(${JSON.stringify(input)})`, sandbox, { filename: 'inline-shape' });
    assert.equal(span.tagName, 'SPAN', `badgeStatus(${JSON.stringify(input)}).tagName`);
    assert.ok(span._attrs.style && span._attrs.style.length > 0, `badgeStatus(${JSON.stringify(input)}).style vazio`);
    assert.equal(span.textContent.length > 0, true, `badgeStatus(${JSON.stringify(input)}).textContent vazio`);
    assert.equal(dotsOf(span).length, 1, `badgeStatus(${JSON.stringify(input)}) deve ter um ponto de status`);
  }
  for (const input of ['latex', 'tecelagem', 'xyz']) {
    const span = vm.runInContext(`badgeTipo(${JSON.stringify(input)})`, sandbox, { filename: 'inline-shape' });
    assert.equal(span.tagName, 'SPAN', `badgeTipo(${JSON.stringify(input)}).tagName`);
    assert.ok(span._attrs.style && span._attrs.style.length > 0, `badgeTipo(${JSON.stringify(input)}).style vazio`);
    assert.equal(span.textContent.length > 0, true, `badgeTipo(${JSON.stringify(input)}).textContent vazio`);
    assert.equal(dotsOf(span).length, 0, `badgeTipo(${JSON.stringify(input)}) nao pode ter ponto de status`);
  }
});
