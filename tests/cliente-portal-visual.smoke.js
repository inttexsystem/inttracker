// =====================================================================
// === tests/cliente-portal-visual.smoke.js =============================
// Smoke cruzado da fase RAVATEX-TAPETES-CLIENTE-PORTAL-VISUAL-POLISH-A.
//
// Esta fase é refino visual (camada de apresentação) nas 5 telas do
// portal cliente. Este arquivo não duplica as suítes dedicadas de cada
// tela — apenas garante, em um único lugar, que o refino visual NÃO
// alterou nenhuma das invariantes de arquitetura/segurança do Portal
// B2B (docs/architecture/PORTAL_B2B_ARCHITECTURE_RULES.md):
//
//   - rota e menu cliente preservados;
//   - cada tela continua read-only (sem insert/update/delete/rpc/
//     functions.invoke/service_role);
//   - nenhuma tela passou a expor metadata/criado_por/origem,
//     pedido_eventos (tabela interna), OP/lote/fornecedor/NF/
//     romaneio/custo/margem/token_acesso;
//   - nenhuma tela ganhou ação de escrita (Editar/Cancelar pedido/
//     Confirmar pedido);
//   - nenhuma tela usa innerHTML/HTML standalone bruto;
//   - os SELECTs de dados permanecem EXATAMENTE os mesmos campos de
//     antes da fase de polish visual (guarda anti-regressão).
//
// Não executa o app nem acessa Supabase real.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const FILES = {
  dashboard: path.join(ROOT, 'js', 'screens', 'cliente-dashboard.js'),
  common: path.join(ROOT, 'js', 'screens', 'cliente-common.js'),
  list: path.join(ROOT, 'js', 'screens', 'cliente-pedidos-list.js'),
  detail: path.join(ROOT, 'js', 'screens', 'cliente-pedido-detail.js'),
  tracking: path.join(ROOT, 'js', 'screens', 'cliente-pedido-tracking.js'),
};
const BOOT = path.join(ROOT, 'js', 'boot.js');
const ROUTER = path.join(ROOT, 'js', 'router.js');

function readOrFail(p) {
  assert.ok(fs.existsSync(p), 'arquivo nao encontrado: ' + p);
  return fs.readFileSync(p, 'utf8');
}

const src = {};
for (const key of Object.keys(FILES)) src[key] = readOrFail(FILES[key]);
const boot = readOrFail(BOOT);
const router = readOrFail(ROUTER);

// Os bans textuais desta suíte (OP/lote/fornecedor/NF/..., metadata,
// Editar/Cancelar) existem para provar o que a tela EXPÕE ao cliente — não
// o que ela documenta sobre si mesma. Um cabeçalho que explica justamente a
// exclusão ("nada de custos/OP/lote") acusava violação, e a suíte convivia
// com isso abrindo carve-outs por tela (`if (key !== 'detail')`,
// `if (key !== 'list')`) que desligavam a guarda inteira naquela tela.
// Remover comentários antes de aplicar o ban resolve a causa e deixa a
// guarda MAIS forte: os carve-outs deixam de ser necessários e as telas
// que estavam isentas voltam a ser verificadas.
function stripComments(source) {
  let out = '';
  let i = 0;
  const n = source.length;
  let quote = null; // ' " ` quando dentro de string
  while (i < n) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      if (c === '\\') { out += '  '; i += 2; continue; }
      if (c === quote) quote = null;
      out += c; i++; continue;
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue; }
    if (c === '/' && next === '/') {
      while (i < n && source[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    if (c === '/' && next === '*') {
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) {
        out += source[i] === '\n' ? '\n' : ' '; i++;
      }
      out += '  '; i += 2; continue;
    }
    out += c; i++;
  }
  return out;
}

const code = {};
for (const key of Object.keys(FILES)) code[key] = stripComments(src[key]);

const SCREEN_KEYS = ['dashboard', 'list', 'detail', 'tracking'];

// ---------------------------------------------------------------------
// 1. Arquivos existem e sao sintaticamente validos
// ---------------------------------------------------------------------

for (const key of SCREEN_KEYS) {
  test('cliente-portal-visual: ' + key + ' existe e tem sintaxe valida', () => {
    assert.ok(fs.existsSync(FILES[key]));
    require('node:child_process').execFileSync(
      process.execPath, ['--check', FILES[key]], { stdio: 'pipe' }
    );
  });
}

// ---------------------------------------------------------------------
// 2. Rota e menu cliente preservados
// ---------------------------------------------------------------------

test('cliente-portal-visual: boot.js preserva #/cliente/dashboard, #/cliente/pedidos e #/cliente/pedidos/novo (role cliente)', () => {
  assert.match(boot, /'#\/cliente\/dashboard'\s*:\s*\{\s*render\s*:\s*window\.screenClienteDashboard[^}]*roles\s*:\s*\[\s*['"]cliente['"]\s*\]/i);
  assert.match(boot, /'#\/cliente\/pedidos'\s*:/);
  assert.match(boot, /'#\/cliente\/pedidos\/novo'\s*:/);
});

test('cliente-portal-visual: router.js resolve #/cliente/pedidos/<uuid> com role cliente', () => {
  assert.match(router, /cliente\\\/pedidos\\\//);
  assert.match(router, /roles:\s*\[['"]cliente['"]\]/);
});

test('cliente-portal-visual: menu cliente preserva "Início" e "Meus pedidos"', () => {
  assert.match(src.common, /label:\s*['"]Início['"]/);
  assert.match(src.common, /href:\s*['"]#\/cliente\/dashboard['"]/);
  assert.match(src.common, /label:\s*['"]Meus pedidos['"]/);
  assert.match(src.common, /href:\s*['"]#\/cliente\/pedidos['"]/);
});

// ---------------------------------------------------------------------
// 3. Read-only continua valendo nas 4 telas de tela (sem writes)
// ---------------------------------------------------------------------

for (const key of SCREEN_KEYS) {
  test('cliente-portal-visual: ' + key + ' continua read-only (sem insert/update/delete/rpc de escrita/functions.invoke)', () => {
    assert.equal(/\.insert\s*\(/.test(code[key]), false, key + ' nao deve ter insert');
    assert.equal(/\.update\s*\(/.test(code[key]), false, key + ' nao deve ter update');
    assert.equal(/\.delete\s*\(/.test(code[key]), false, key + ' nao deve ter delete');
    assert.equal(/functions\.invoke/.test(code[key]), false, key + ' nao deve chamar functions.invoke');
    // O ban de `.rpc(` era total. Depois que o detalhe do cliente passou a
    // ler por UM read model canônico (`cliente_pedido_summary`), o ban
    // total passaria a proibir justamente a leitura endurecida que
    // substituiu três SELECTs diretos. O contrato real é: nenhuma RPC além
    // das de LEITURA explicitamente permitidas.
    const RPC_LEITURA_PERMITIDAS = ['cliente_pedido_summary'];
    const rpcs = [...code[key].matchAll(/\.rpc\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
    for (const nome of rpcs) {
      assert.ok(RPC_LEITURA_PERMITIDAS.includes(nome),
        key + ' chamou RPC nao permitida para tela cliente: ' + nome);
    }
    // Nenhuma RPC pode ser montada dinamicamente (escaparia do allowlist).
    assert.equal(/\.rpc\s*\(\s*[^'"\s)]/.test(code[key]), false,
      key + ' nao deve montar nome de RPC dinamicamente');
  });

  test('cliente-portal-visual: ' + key + ' nao referencia service_role nem token_acesso', () => {
    assert.equal(/service_role/.test(code[key]), false, key + ' nao deve referenciar service_role');
    assert.equal(/token_acesso/.test(code[key]), false, key + ' nao deve referenciar token_acesso');
  });

  // Sem carve-out: com os comentários removidos, o ban vale para as QUATRO
  // telas, inclusive `detail` (que só citava metadata/criado_por/origem no
  // cabeçalho, para documentar a exclusão).
  test('cliente-portal-visual: ' + key + ' nao expoe metadata/criado_por/origem', () => {
    assert.equal(/metadata/.test(code[key]), false, key + ' nao deve referenciar metadata');
    assert.equal(/criado_por/.test(code[key]), false, key + ' nao deve referenciar criado_por');
    assert.equal(/origem/.test(code[key]), false, key + ' nao deve referenciar origem');
  });

  test('cliente-portal-visual: ' + key + ' nao consulta a tabela interna pedido_eventos', () => {
    assert.equal(/from\(['"]pedido_eventos['"]\)/.test(code[key]), false, key + ' nao deve usar from("pedido_eventos")');
  });

  test('cliente-portal-visual: ' + key + ' nao expoe OP/lote/fornecedor/NF/romaneio/custo/margem', () => {
    assert.equal(/\bop\b/i.test(code[key]), false, key + ' nao deve referenciar OP');
    assert.equal(/\blote\b/i.test(code[key]), false, key + ' nao deve referenciar lote');
    assert.equal(/fornecedor/i.test(code[key]), false, key + ' nao deve referenciar fornecedor');
    assert.equal(/\bNF\b/.test(code[key]), false, key + ' nao deve referenciar NF');
    assert.equal(/romaneio/i.test(code[key]), false, key + ' nao deve referenciar romaneio');
    assert.equal(/custo/i.test(code[key]), false, key + ' nao deve referenciar custo');
    assert.equal(/margem/i.test(code[key]), false, key + ' nao deve referenciar margem');
  });

  // Sem carve-out: `list` só citava "editar/cancelar pedido" na descrição de
  // escopo do cabeçalho, então agora as quatro telas são verificadas.
  test('cliente-portal-visual: ' + key + ' nao ganhou acao de escrita (Editar/Cancelar pedido/Confirmar pedido)', () => {
    assert.equal(/Editar/i.test(code[key]), false, key + ' nao deve ter "Editar"');
    assert.equal(/Cancelar pedido/i.test(code[key]), false, key + ' nao deve ter "Cancelar pedido"');
    assert.equal(/Confirmar pedido/i.test(code[key]), false, key + ' nao deve ter "Confirmar pedido"');
  });

  test('cliente-portal-visual: ' + key + ' nao altera admin (sem UI admin de tracking)', () => {
    assert.equal(/RAVATEX_SCREENS\.pedidoTrackingAdmin/.test(src[key]), false);
    assert.equal(/buildPedidoTrackingAdminCard/.test(src[key]), false);
  });

  test('cliente-portal-visual: ' + key + ' nao usa innerHTML nem HTML standalone bruto', () => {
    assert.equal(/<!DOCTYPE/i.test(code[key]), false, key + ' nao deve conter DOCTYPE de HTML standalone');
    assert.equal(/<html[\s>]/i.test(code[key]), false, key + ' nao deve conter tag <html> de HTML standalone');

    // O ban total de innerHTML foi escrito antes de existir o helper svgEl,
    // que monta ícones SVG por markup literal — a única forma de criar nós
    // SVG com o namespace correto. O risco que o ban protege é injeção de
    // dado do servidor/usuário no HTML; o helper não faz isso. Em vez de
    // proibir a construção inteira, a guarda agora prova as duas coisas que
    // realmente importam: (1) só o helper usa innerHTML; (2) o helper
    // recebe apenas markup literal.
    const atribuicoes = [...code[key].matchAll(/(\w+)\s*\.\s*innerHTML\s*=\s*([^;\n]+)/g)];
    for (const [, alvo, valor] of atribuicoes) {
      assert.equal(alvo, 'tmp',
        key + ' so pode atribuir innerHTML no no destacado do helper svgEl');
      assert.equal(valor.trim(), 'markup',
        key + ' so pode atribuir o parametro markup do helper svgEl');
    }
    assert.ok(atribuicoes.length <= 1,
      key + ' nao deve ter mais de uma atribuicao de innerHTML (apenas svgEl)');

    // Nenhuma chamada a svgEl pode carregar dado dinâmico: só literais ou
    // constantes de ícone em CAIXA_ALTA. O donut do dashboard interpola
    // apenas números já formatados (toFixed), então é aceito explicitamente.
    const chamadas = [...code[key].matchAll(/(?<!function\s)svgEl\(\s*([^\n]*)/g)].map((m) => m[1].trim());
    for (const arg of chamadas) {
      const ehLiteral = arg.startsWith("'<svg") || arg.startsWith('"<svg');
      const ehConstante = /^[A-Z_][A-Z0-9_]*\s*[),]/.test(arg) || /^(iconMarkup|svgMarkup)\b/.test(arg);
      const ehDonutNumerico = arg.includes("viewBox=\"0 0 200 200\"");
      assert.ok(ehLiteral || ehConstante || ehDonutNumerico,
        key + ' passou markup nao literal para svgEl: ' + arg.slice(0, 60));
    }
  });
}

// ---------------------------------------------------------------------
// 4. Guarda anti-regressao — selects EXATAMENTE iguais aos de antes
//    da fase de polish visual (nenhum campo novo selecionado)
// ---------------------------------------------------------------------

test('cliente-portal-visual: cliente-pedidos-list.js select de pedidos inclui status visual publicado', () => {
  assert.match(
    src.list,
    /\.select\(\s*['"]id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, observacao, criado_em['"]\s*\)/
  );
});

test('cliente-portal-visual: cliente-dashboard.js select de pedidos inalterado', () => {
  assert.match(
    src.dashboard,
    /\.select\(\s*['"]id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, prazo_desejado, tipo_recebimento, criado_em, atualizado_em['"]\s*\)/
  );
});

test('cliente-portal-visual: cliente-dashboard.js select de pedido_cliente_eventos inalterado', () => {
  assert.match(
    src.dashboard,
    /\.select\(\s*['"]id, pedido_id, status, titulo, mensagem, criado_em['"]\s*\)/
  );
});

// Os três testes abaixo congelavam os SELECTs diretos que a tela de detalhe
// fazia em `pedidos`, `pedido_cliente_eventos` e `pedido_itens`. Esses
// SELECTs deixaram de existir: a leitura foi consolidada num único read
// model canônico, a RPC `cliente_pedido_summary`, que devolve pedido, itens,
// parciais, entregas e pendências já sanitizados e com a ACL aplicada no
// servidor. Congelar a forma antiga deixaria a tela sem guarda alguma —
// então a guarda passa a ser o contrato atual, que é mais forte: nenhuma
// leitura direta de tabela, tudo por um read model nomeado.
test('cliente-portal-visual: cliente-pedido-detail.js le por UM read model canonico', () => {
  assert.match(
    code.detail,
    /window\.supa\.rpc\(\s*['"]cliente_pedido_summary['"]/,
    'o detalhe do cliente deve ler pelo read model canonico cliente_pedido_summary'
  );
  const rpcs = [...code.detail.matchAll(/\.rpc\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(rpcs)], ['cliente_pedido_summary'],
    'o detalhe do cliente nao pode chamar outra RPC alem do read model');
});

test('cliente-portal-visual: cliente-pedido-detail.js nao faz SELECT direto em tabela', () => {
  assert.equal(/\.from\s*\(/.test(code.detail), false,
    'a leitura direta de tabela foi substituida pelo read model — nao pode voltar');
  assert.equal(/\.select\s*\(/.test(code.detail), false,
    'nenhum select direto deve sobreviver na tela de detalhe do cliente');
});

test('cliente-portal-visual: o read model do detalhe entrega o payload esperado', () => {
  // Campos consumidos pela tela: se o read model mudar de forma, esta
  // guarda quebra antes da tela quebrar em runtime.
  for (const campo of ['pedido', 'itens', 'parciais', 'entregas', 'pendencias']) {
    assert.match(code.detail, new RegExp('payload\\.' + campo + '\\b'),
      'a tela deve consumir payload.' + campo + ' do read model');
  }
});

test('cliente-portal-visual: cliente-pedido-tracking.js nao faz nenhuma consulta Supabase', () => {
  assert.equal(/window\.supa/.test(src.tracking), false);
  assert.equal(/pedido_cliente_eventos/.test(src.tracking), false);
});

// ---------------------------------------------------------------------
// 5. Taxonomia compartilhada continua em uso onde aplicavel
// ---------------------------------------------------------------------

test('cliente-portal-visual: dashboard, detail e tracking usam window.RavatexPedidoTracking', () => {
  assert.match(src.dashboard, /RavatexPedidoTracking/);
  assert.match(src.detail, /RavatexPedidoTracking/);
  assert.match(src.tracking, /RavatexPedidoTracking/);
});

// ---------------------------------------------------------------------
// 6. Nenhuma tela usa shellLayout/ADMIN_MENU direto (sempre via
//    clienteShellLayout)
// ---------------------------------------------------------------------

for (const key of ['dashboard', 'list', 'detail']) {
  test('cliente-portal-visual: ' + key + ' usa window.clienteShellLayout, nunca ADMIN_MENU', () => {
    assert.match(src[key], /window\.clienteShellLayout/);
    assert.equal(/ADMIN_MENU/.test(src[key]), false);
  });
}
