// =====================================================================
// === TEST HARNESS: leitura canônica das fontes do app ================
//
// Helper compartilhado das smoke tests ESTÁTICAS. Existe para que as
// asserções estruturais dependam do CONTRATO do produto e não de dois
// detalhes de ambiente/histórico que já produziram falsos negativos:
//
//   1. FIM DE LINHA. O repositório grava LF no object database, mas o
//      checkout no Windows roda com `core.autocrlf=true` e não há
//      `.gitattributes`, então a árvore de trabalho fica MISTA: arquivos
//      recém-reescritos ficam LF e os demais viram CRLF. Regexes
//      multilinha escritas com `\n` casavam num checkout LF e falhavam
//      num checkout CRLF — mesma fonte, mesmo produto, resultado
//      diferente por plataforma. `readSource` normaliza para LF na
//      leitura; nenhuma asserção precisa saber disso.
//
//   2. SCRIPT DE BOOT. index.html não tem mais nenhum `<script>` inline:
//      o entrypoint foi extraído para js/boot.js (rotas via
//      RAVATEX_ROUTER.setRoutes + main()) e as telas/helpers para seus
//      próprios módulos. Os testes que ainda falam em "script inline"
//      descrevem o BOOT SCRIPT do app; `readBootScript` devolve essa
//      fonte pelo dono atual, mantendo a asserção original válida.
//
// Não afrouxa nenhum contrato: só remove do caminho crítico duas
// premissas de harness que deixaram de ser verdadeiras.
// =====================================================================

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Caminho canônico do entrypoint de boot (sucessor do <script> inline).
const BOOT_REL = path.join('js', 'boot.js');

function toLf(src) {
  return String(src).replace(/\r\n/g, '\n');
}

// Lê uma fonte do produto normalizada em LF. Aceita caminho relativo à
// raiz do repositório ou absoluto.
function readSource(rel) {
  const p = path.isAbsolute(rel) ? rel : path.join(ROOT, rel);
  return toLf(fs.readFileSync(p, 'utf8'));
}

function readIndexHtml() {
  return readSource('index.html');
}

// Fonte do script de boot do app. Se algum dia index.html voltar a ter um
// `<script>` inline, ele é considerado junto — o helper descreve "o código
// de bootstrap do app", não um arquivo específico.
function readBootScript(html) {
  const src = typeof html === 'string' ? html : readIndexHtml();
  const inline = extractInlineScripts(src);
  const boot = readSource(BOOT_REL);
  return inline.length ? inline.join('\n') + '\n' + boot : boot;
}

function extractInlineScripts(html) {
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim()) out.push(m[1]);
  }
  return out;
}

// Índice do `<script src="...">` de um módulo, tolerante ao cache-token
// `?v=` que index.html usa em todos os assets locais. Devolve -1 quando
// ausente.
function scriptIndex(html, src) {
  const re = new RegExp(
    `<script\\s+src="${escapeRe(src)}(?:\\?[^"]*)?"[^>]*></script>`
  );
  const m = re.exec(html);
  return m ? m.index : -1;
}

// Quantas vezes um módulo é carregado (esperado: exatamente 1).
function countScriptTags(html, src) {
  const re = new RegExp(
    `<script\\s+src="${escapeRe(src)}(?:\\?[^"]*)?"[^>]*></script>`,
    'g'
  );
  return (html.match(re) || []).length;
}

// Índice do script de boot dentro de index.html — o marcador que os
// testes de ORDEM usavam quando o boot era inline.
function bootScriptIndex(html) {
  return scriptIndex(html, 'js/boot.js');
}

function escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
}

module.exports = {
  ROOT,
  BOOT_REL,
  toLf,
  readSource,
  readIndexHtml,
  readBootScript,
  extractInlineScripts,
  scriptIndex,
  countScriptTags,
  bootScriptIndex,
};
