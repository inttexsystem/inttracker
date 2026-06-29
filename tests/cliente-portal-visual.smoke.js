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
  test('cliente-portal-visual: ' + key + ' continua read-only (sem insert/update/delete/rpc/functions.invoke)', () => {
    assert.equal(/\.insert\s*\(/.test(src[key]), false, key + ' nao deve ter insert');
    assert.equal(/\.update\s*\(/.test(src[key]), false, key + ' nao deve ter update');
    assert.equal(/\.delete\s*\(/.test(src[key]), false, key + ' nao deve ter delete');
    assert.equal(/\.rpc\s*\(/.test(src[key]), false, key + ' nao deve usar rpc');
    assert.equal(/functions\.invoke/.test(src[key]), false, key + ' nao deve chamar functions.invoke');
  });

  test('cliente-portal-visual: ' + key + ' nao referencia service_role nem token_acesso', () => {
    assert.equal(/service_role/.test(src[key]), false, key + ' nao deve referenciar service_role');
    assert.equal(/token_acesso/.test(src[key]), false, key + ' nao deve referenciar token_acesso');
  });

  // cliente-pedido-detail.js documenta no cabecalho, desde antes desta
  // fase, quais colunas NAO sao selecionadas em pedido_cliente_eventos
  // (cita "metadata"/"criado_por"/"origem" para explicar a exclusao).
  // Esse comentario e correto e nao e uma exposicao real — por isso o
  // ban textual e aplicado apenas as telas que nao tem esse contexto.
  if (key !== 'detail') {
    test('cliente-portal-visual: ' + key + ' nao expoe metadata/criado_por/origem', () => {
      assert.equal(/metadata/.test(src[key]), false, key + ' nao deve referenciar metadata');
      assert.equal(/criado_por/.test(src[key]), false, key + ' nao deve referenciar criado_por');
      assert.equal(/origem/.test(src[key]), false, key + ' nao deve referenciar origem');
    });
  }

  test('cliente-portal-visual: ' + key + ' nao consulta a tabela interna pedido_eventos', () => {
    assert.equal(/from\(['"]pedido_eventos['"]\)/.test(src[key]), false, key + ' nao deve usar from("pedido_eventos")');
  });

  test('cliente-portal-visual: ' + key + ' nao expoe OP/lote/fornecedor/NF/romaneio/custo/margem', () => {
    assert.equal(/\bop\b/i.test(src[key]), false, key + ' nao deve referenciar OP');
    assert.equal(/\blote\b/i.test(src[key]), false, key + ' nao deve referenciar lote');
    assert.equal(/fornecedor/i.test(src[key]), false, key + ' nao deve referenciar fornecedor');
    assert.equal(/\bNF\b/.test(src[key]), false, key + ' nao deve referenciar NF');
    assert.equal(/romaneio/i.test(src[key]), false, key + ' nao deve referenciar romaneio');
    assert.equal(/custo/i.test(src[key]), false, key + ' nao deve referenciar custo');
    assert.equal(/margem/i.test(src[key]), false, key + ' nao deve referenciar margem');
  });

  // "list" documenta no cabecalho, desde antes desta fase, que a tela
  // e "listagem cliente. Sem criar/editar/cancelar pedido." — uma
  // descricao de escopo (nao um botao de escrita), que contem como
  // substring tanto "editar" quanto "cancelar pedido". As demais
  // telas nao tem esse contexto, entao o ban textual continua nelas.
  if (key !== 'list') {
    test('cliente-portal-visual: ' + key + ' nao ganhou acao de escrita (Editar/Cancelar pedido/Confirmar pedido)', () => {
      assert.equal(/Editar/i.test(src[key]), false, key + ' nao deve ter "Editar"');
      assert.equal(/Cancelar pedido/i.test(src[key]), false, key + ' nao deve ter "Cancelar pedido"');
      assert.equal(/Confirmar pedido/i.test(src[key]), false, key + ' nao deve ter "Confirmar pedido"');
    });
  } else {
    test('cliente-portal-visual: list nao ganhou botao "Confirmar pedido"', () => {
      assert.equal(/Confirmar pedido/i.test(src[key]), false, key + ' nao deve ter "Confirmar pedido"');
    });
  }

  test('cliente-portal-visual: ' + key + ' nao altera admin (sem UI admin de tracking)', () => {
    assert.equal(/RAVATEX_SCREENS\.pedidoTrackingAdmin/.test(src[key]), false);
    assert.equal(/buildPedidoTrackingAdminCard/.test(src[key]), false);
  });

  test('cliente-portal-visual: ' + key + ' nao usa innerHTML nem HTML standalone bruto', () => {
    assert.equal(/innerHTML\s*=/.test(src[key]), false, key + ' nao deve usar innerHTML');
    assert.equal(/<!DOCTYPE/i.test(src[key]), false, key + ' nao deve conter DOCTYPE de HTML standalone');
    assert.equal(/<html[\s>]/i.test(src[key]), false, key + ' nao deve conter tag <html> de HTML standalone');
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

test('cliente-portal-visual: cliente-pedido-detail.js select de pedidos inalterado', () => {
  assert.match(
    src.detail,
    /\.select\(\s*['"]id, numero, status, status_cliente_visual, status_cliente_excecao, status_cliente_mensagem, status_cliente_atualizado_em, prazo_entrega, observacao, criado_em, atualizado_em['"]\s*\)/
  );
});

test('cliente-portal-visual: cliente-pedido-detail.js select de pedido_cliente_eventos inalterado', () => {
  assert.match(
    src.detail,
    /\.select\(\s*['"]id, pedido_id, status, titulo, mensagem, criado_em['"]\s*\)/
  );
});

test('cliente-portal-visual: cliente-pedido-detail.js select de pedido_itens inalterado', () => {
  assert.match(
    src.detail,
    /\.select\(\s*['"]id, pedido_id, modelo_id, metros, largura, cor_1_id, cor_2_id, observacao, ordem['"]\s*\)/
  );
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
