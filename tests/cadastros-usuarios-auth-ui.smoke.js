// =====================================================================
// === tests/cadastros-usuarios-auth-ui.smoke.js =======================
// Smoke estático para a adaptação da tela #/cadastros/usuarios
// às Edge Functions `admin-create-user` (fase AUTH-ADMIN-UI-A) e
// `admin-disable-user` (fase RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A).
//
// Verifica (sem executar o app nem Supabase real):
//   - cadastros.js chama functions.invoke('admin-create-user');
//   - cadastros.js chama functions.invoke('admin-disable-user');
//   - payload de admin-disable-user contém user_id e reason;
//   - botão "Desativar" substitui o placeholder "Em breve";
//   - placeholder "Em breve" não é mais usado como ação primária;
//   - trata erros de admin-disable-user lendo error.context.json();
//   - mapeia códigos: SELF_DISABLE_FORBIDDEN, LAST_ADMIN_FORBIDDEN,
//     FORBIDDEN, NOT_FOUND, AUTH_BAN_FAILED, COMPENSATION_FAILED,
//     VALIDATION_ERROR, UNAUTHORIZED;
//   - guarda de UX para o próprio usuário e usuários já inativos
//     (proteção visual; server-side é a barreira real);
//   - não contém service_role, SUPABASE_SERVICE_ROLE_KEY, auth.admin;
//   - não usa .from('usuarios').delete() (soft delete only);
//   - não referencia js/config.js nem supabase/functions;
//   - preserva "+ Novo usuário" e chamada admin-create-user.
//
// Executar com: node --test tests/cadastros-usuarios-auth-ui.smoke.js
// =====================================================================

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const cadastrosPath = path.join(ROOT, "js", "screens", "cadastros.js");

const src = fs.readFileSync(cadastrosPath, "utf8");

// ---------------------------------------------------------------------
// Fluxo de criação (admin-create-user) — AUTH-ADMIN-UI-A
// ---------------------------------------------------------------------

test("cadastros.js: chama functions.invoke('admin-create-user') no fluxo de criação", () => {
  assert.match(
    src,
    /functions\.invoke\(\s*['"]admin-create-user['"]/,
  );
});

test("cadastros.js: botão principal rotula '+ Novo usuário' e remove '+ Vincular usuário'", () => {
  assert.match(src, /\+ Novo usu[áa]rio/);
  assert.doesNotMatch(src, /\+ Vincular usu[áa]rio/);
});

test("cadastros.js: remove banner antigo 'Como criar um usuário novo'", () => {
  assert.doesNotMatch(src, /Como criar um usu[áa]rio novo/);
  assert.doesNotMatch(src, /Supabase Studio/);
});

test("cadastros.js: título do modal de criação é 'Novo usuário' e 'Vincular usuário' foi removido", () => {
  assert.match(src, /'Novo usu[áa]rio'/);
  assert.doesNotMatch(src, /'Vincular usu[áa]rio'/);
});

test("cadastros.js: remove validação antiga que exigia UID manual", () => {
  assert.doesNotMatch(src, /Preencha UID, email, nome e tipo/);
  assert.doesNotMatch(src, /const\s+id\s*=\s*idInput\.value/);
});

test("cadastros.js: payload da Edge Function admin-create-user contém email, password, nome, tipo, fornecedor_id", () => {
  assert.match(src, /body:\s*\{[^}]*email/);
  assert.match(src, /body:\s*\{[^}]*password/);
  assert.match(src, /body:\s*\{[^}]*nome/);
  assert.match(src, /body:\s*\{[^}]*tipo/);
  assert.match(src, /body:\s*\{[^}]*fornecedor_id/);
});

test("cadastros.js: trata erro da Edge Function admin-create-user lendo error.context.json()", () => {
  assert.match(src, /error\.context/);
  assert.match(src, /error\.context\.json/);
  assert.match(src, /body\.error\.code/);
});

// ---------------------------------------------------------------------
// Segurança comum (auth.create-user + admin-disable-user)
// ---------------------------------------------------------------------

test("cadastros.js: não contém service_role", () => {
  assert.doesNotMatch(src, /service_role/i);
});

test("cadastros.js: não contém SUPABASE_SERVICE_ROLE_KEY", () => {
  assert.doesNotMatch(src, /SUPABASE_SERVICE_ROLE_KEY/);
});

test("cadastros.js: não chama auth.admin", () => {
  assert.doesNotMatch(src, /auth\.admin/);
});

test("cadastros.js: não referencia js/config.js", () => {
  assert.doesNotMatch(src, /js\/config\.js/);
});

test("cadastros.js: não referencia supabase/functions", () => {
  assert.doesNotMatch(src, /supabase\/functions/);
});

// ---------------------------------------------------------------------
// AUTH-DELETE-UI-GUARD-A — caminho inseguro de exclusão removido
// ---------------------------------------------------------------------

test("cadastros.js: não chama .from('usuarios').delete() no fluxo de exclusão de usuário", () => {
  assert.doesNotMatch(
    src,
    /from\(\s*['"]usuarios['"]\s*\)\s*\.\s*delete\s*\(/,
    "cadastros.js ainda executa .from('usuarios').delete() — caminho inseguro de exclusão deve estar removido",
  );
});

test("cadastros.js: removeu confirmExcluir do fluxo de usuários", () => {
  // confirmExcluir ainda é usado por outras telas de cadastro
  // (Cores, Clientes, Modelos, Fornecedores, Preços), o que é
  // intencional. Esta fase remove apenas o confirmExcluir do fluxo
  // de USUÁRIOS.
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0, "screenCadastrosUsuarios não encontrada em cadastros.js");
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  assert.doesNotMatch(
    bloco,
    /confirmExcluir\s*\(/,
    "confirmExcluir ainda é referenciada dentro de screenCadastrosUsuarios",
  );
  assert.doesNotMatch(
    bloco,
    /'Excluir v[íi]nculo'/,
    "rótulo 'Excluir vínculo' ainda é referenciado dentro de screenCadastrosUsuarios",
  );
});

// ---------------------------------------------------------------------
// RAVATEX-TAPETES-AUTH-DISABLE-USER-UI-A — botão "Desativar" + Edge
// Function admin-disable-user
// ---------------------------------------------------------------------

test("cadastros.js: tem botão 'Desativar' no fluxo de usuários (substitui 'Em breve')", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0, "screenCadastrosUsuarios não encontrada em cadastros.js");
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  assert.match(bloco, /'Desativar'/, "rótulo 'Desativar' deve estar presente");
  // O placeholder antigo não pode mais aparecer como ação primária.
  assert.doesNotMatch(
    bloco,
    /'Em breve'/,
    "rótulo 'Em breve' ainda é referenciado dentro de screenCadastrosUsuarios",
  );
});

test("cadastros.js: chama functions.invoke('admin-disable-user') no fluxo de desativação", () => {
  assert.match(
    src,
    /functions\.invoke\(\s*['"]admin-disable-user['"]/,
  );
});

test("cadastros.js: payload de admin-disable-user contém user_id e reason", () => {
  // Localiza a chamada real (não a do comentário) procurando por
  // `user_id: usr.id` (literal único da chamada) e pega o bloco
  // functions.invoke correspondente.
  const callIdx = src.indexOf("user_id: usr.id");
  assert.ok(
    callIdx > 0,
    "bloco real de admin-disable-user (com user_id: usr.id) deve existir",
  );
  // Pega o trecho anterior até o functions.invoke aberto.
  const invokeStart = src.lastIndexOf("functions.invoke(", callIdx);
  assert.ok(invokeStart > 0, "functions.invoke deve aparecer antes do user_id");
  // Pega o trecho até o fechamento do invoke (parêntese balanceado:
  // procuramos o ");" mais próximo depois do callIdx).
  const invokeEnd = src.indexOf(");", callIdx);
  assert.ok(invokeEnd > 0, "fechamento do invoke deve existir");
  const block = src.slice(invokeStart, invokeEnd + 2);
  assert.match(block, /admin-disable-user/, "deve chamar admin-disable-user");
  assert.match(block, /user_id/, "payload deve conter user_id");
  assert.match(block, /reason/, "payload deve conter reason");
  // Confirma formato user_id: usr.id (do objeto da linha) e não apenas
  // placeholders.
  assert.match(block, /user_id:\s*usr\.id/, "payload deve enviar user_id = usr.id");
  assert.match(block, /reason/, "payload deve enviar reason");
});

test("cadastros.js: trata erro de admin-disable-user lendo error.context.json()", () => {
  // Usa o mesmo anchor do teste anterior (user_id: usr.id) para
  // garantir que pegamos o bloco real, não o do comentário.
  const callIdx = src.indexOf("user_id: usr.id");
  assert.ok(callIdx > 0, "bloco real de admin-disable-user deve existir");
  const invokeEnd = src.indexOf(");", callIdx);
  assert.ok(invokeEnd > 0);
  // Pega 800 chars após o fechamento do invoke para incluir o
  // tratamento de erro.
  const bloco = src.slice(callIdx, invokeEnd + 2 + 800);
  assert.match(bloco, /error\.context/, "deve ler error.context");
  assert.match(bloco, /error\.context\.json/, "deve parsear error.context.json()");
  assert.match(bloco, /body\.error\.code/, "deve ler body.error.code");
});

test("cadastros.js: trata SELF_DISABLE_FORBIDDEN, LAST_ADMIN_FORBIDDEN, FORBIDDEN, NOT_FOUND, AUTH_BAN_FAILED, COMPENSATION_FAILED, VALIDATION_ERROR, UNAUTHORIZED", () => {
  for (const code of [
    "FORBIDDEN",
    "SELF_DISABLE_FORBIDDEN",
    "LAST_ADMIN_FORBIDDEN",
    "NOT_FOUND",
    "AUTH_BAN_FAILED",
    "COMPENSATION_FAILED",
    "VALIDATION_ERROR",
    "UNAUTHORIZED",
  ]) {
    assert.match(
      src,
      new RegExp("['\"]" + code + "['\"]"),
      "deve mapear código " + code + " em friendlyDisableMessage ou no fluxo de erro",
    );
  }
});

test("cadastros.js: guarda de UX bloqueia desativação do próprio usuário logado", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  // Deve referenciar CURRENT_USER (origem do meId).
  assert.match(
    bloco,
    /window\.CURRENT_USER/,
    "deve referenciar window.CURRENT_USER",
  );
  // Deve extrair CURRENT_USER.id para uma variável local (meId ou
  // similar) e comparar com r.id em qualquer ordem.
  const hasCurrentUserId = /window\.CURRENT_USER[\s\S]{0,200}\.id/;
  assert.match(
    bloco,
    hasCurrentUserId,
    "deve extrair window.CURRENT_USER.id para uma variável local",
  );
  const selfCompare = /r\.id\s*===?\s*\w+|\w+\.id\s*===?\s*r\.id/;
  assert.match(
    bloco,
    selfCompare,
    "deve comparar r.id com a variável derivada de CURRENT_USER.id",
  );
  // Deve emitir toast informativo em vez de chamar a Edge Function.
  assert.match(
    bloco,
    /n[ãa]o pode desativar seu pr[óo]prio usu[áa]rio/i,
    "deve mostrar mensagem amigável ao tentar auto-desativação",
  );
});

test("cadastros.js: guarda de UX bloqueia desativação de usuário já inativo", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  // Deve verificar r.ativo === false e emitir toast.
  assert.match(
    bloco,
    /r\.ativo\s*===\s*false/,
    "deve checar r.ativo === false para detectar inativo",
  );
  assert.match(
    bloco,
    /usu[áa]rio j[áa] est[áa] inativo/i,
    "deve mostrar mensagem amigável ao tentar desativar inativo",
  );
});

test("cadastros.js: listagem carrega coluna ativo (Status Ativo/Inativo)", () => {
  // Confirma que o select inclui 'ativo' para diferenciar visualmente
  // usuários ativos e inativos.
  assert.match(
    src,
    /select\(['"][^'"]*ativo[^'"]*['"]/,
    "select de usuarios deve incluir a coluna ativo",
  );
  assert.match(
    src,
    /r\.ativo\s*===\s*false\s*\?\s*['"]Inativo['"]/,
    "deve renderizar coluna Status como Inativo quando ativo === false",
  );
});

// ---------------------------------------------------------------------
// RAVATEX-TAPETES-USERS-INACTIVE-LIST-UX-A — esconder inativos
// por padrão + toggle "Mostrar inativos" + botão Inativo
// (não aciona admin-disable-user para usuários com ativo === false)
// ---------------------------------------------------------------------

test("cadastros.js: estado local de filtro manter/mostrar inativos existe", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0, "screenCadastrosUsuarios não encontrada");
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  assert.match(
    bloco,
    /let\s+mostrarInativos\s*=\s*false/,
    "deve declarar estado local `let mostrarInativos = false`",
  );
});

test("cadastros.js: filtro de listagem exclui inativos por padrão", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  assert.match(
    bloco,
    /\(\s*u\s*\)\s*=>\s*u\.ativo\s*!==\s*false/,
    "deve filtrar usuarios por u.ativo !== false quando mostrarInativos === false",
  );
});

test("cadastros.js: exibe toggle/checkbox 'Mostrar inativos' na tela", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const bloco = src.slice(idx);
  assert.match(
    bloco,
    /Mostrar inativos/,
    "label 'Mostrar inativos' deve aparecer na tela",
  );
  assert.match(
    bloco,
    /type\s*:\s*['"]checkbox['"]/,
    "deve usar um <input type='checkbox'> para o toggle (formato attrs obj)",
  );
});

test("cadastros.js: mensagem amigável quando não há usuários ativos", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  assert.match(
    bloco,
    /Nenhum usu[áa]rio ativo encontrado/,
    "deve exibir 'Nenhum usuário ativo encontrado' quando filtro está fechado",
  );
});

test("cadastros.js: para inativos, ação é label 'Inativo' (não aciona admin-disable-user)", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);
  // Deve existir um label dinâmico (função) que retorna 'Inativo'
  // quando r.ativo === false.
  assert.match(
    bloco,
    /label:\s*\(\s*r\s*\)\s*=>\s*\(\s*r\s*&&\s*r\.ativo\s*===\s*false\s*\)\s*\?\s*['"]Inativo['"]/,
    "deve usar label dinâmico que retorna 'Inativo' para r.ativo === false",
  );
  // O onclick deve passar por handleDesativarClick (que tem guarda para inativo).
  assert.match(
    bloco,
    /onclick:\s*\(\s*r\s*\)\s*=>\s*handleDesativarClick\s*\(\s*r\s*,\s*meId\s*\)/,
    "onclick deve chamar handleDesativarClick (que tem guarda para inativo)",
  );
});

test("cadastros.js: preserva botão '+ Novo usuário' e chamada admin-create-user", () => {
  assert.match(src, /\+ Novo usu[áa]rio/);
  assert.match(src, /functions\.invoke\(\s*['"]admin-create-user['"]/);
});

// ---------------------------------------------------------------------
// RAVATEX-TAPETES-PEDIDOS-CLIENTE-PROV-A — suporte a tipo 'cliente'
// ---------------------------------------------------------------------

test("cadastros.js: tipoOptions contém 'cliente'", () => {
  assert.match(src, /value:\s*'cliente'/);
});

test("cadastros.js: tipo cliente mostra select de cliente e exige cliente_id", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);

  assert.match(bloco, /clienteSel/, "deve ter clienteSel para o select de cliente");
  assert.match(bloco, /wrapperCli/, "deve ter wrapperCli para controle de visibilidade");
  assert.match(bloco, /cliente.*vinculado/i, "deve exigir cliente vinculado");
});

test("cadastros.js: onSave valida tipo cliente — exige cliente_id", () => {
  assert.match(src, /Usuário tipo "cliente" precisa de cliente vinculado/);
});

test("cadastros.js: onSave valida tipo cliente — rejeita fornecedor_id", () => {
  assert.match(src, /Usuário cliente não pode ter fornecedor vinculado/);
});

test("cadastros.js: onSave valida tipo admin — rejeita cliente_id", () => {
  assert.match(src, /Usuário admin não pode ter cliente vinculado/);
});

test("cadastros.js: onSave valida tipo fornecedor — rejeita cliente_id", () => {
  assert.match(src, /Usuário fornecedor não pode ter cliente vinculado/);
});

test("cadastros.js: carrega lista de clientes para popular select", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);

  assert.match(bloco, /\.from\(['"]clientes['"]\)/, "deve consultar tabela clientes");
  assert.match(bloco, /allClients/, "deve armazenar clientes em allClients");
});

test("cadastros.js: payload de criação inclui cliente_id", () => {
  // Localiza a chamada functions.invoke('admin-create-user') com cliente_id
  const idx = src.indexOf("functions.invoke('admin-create-user'");
  assert.ok(idx > 0, "chamada admin-create-user não encontrada");
  const bloco = src.slice(idx, idx + 400);
  assert.match(bloco, /cliente_id/, "payload deve incluir cliente_id");
});

test("cadastros.js: coluna Cliente aparece na listagem de usuários", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);

  assert.match(bloco, /key:\s*'cliente'\s*,\s*label:\s*'Cliente'/,
    "deve ter coluna Cliente na tabela de usuários");
  assert.match(bloco, /r\.cliente\?\.nome/,
    "deve renderizar r.cliente?.nome na coluna Cliente");
});

test("cadastros.js: select de usuarios inclui cliente:cliente_id(id, nome)", () => {
  const idx = src.indexOf("function screenCadastrosUsuarios()");
  assert.ok(idx > 0);
  const nextFn = src.indexOf("async function screenCadastros", idx + 1);
  const bloco = src.slice(idx, nextFn > 0 ? nextFn : src.length);

  assert.match(bloco, /cliente:cliente_id\(id,\s*nome\)/,
    "select de usuarios deve incluir join cliente:cliente_id(id, nome)");
});
