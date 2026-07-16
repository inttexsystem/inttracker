// =====================================================================
// === ADMIN USUARIOS WRITES (Camada 2 — A3.1) ==========================
// Extraído 1:1 de js/screens/cadastros.js (screenCadastrosUsuarios,
// linhas 2226-2713), sem alteração de comportamento. Concentra os reads
// de listagem e os writes de usuário (Edge Functions + PostgREST update)
// usados pela tela de administração de usuários.
//
// Segue o mesmo contrato de js/screens/op-writes.js e
// js/screens/entrega-writes.js: módulo de write puro, sem
// window.toast/window.navigate/DOM. Toda apresentação (toast, mapeamento
// de mensagem amigável para o usuário) fica no chamador
// (js/screens/admin-usuarios-modal.js).
//
// Carregar via <script src="js/admin-usuarios-writes.js"></script> no
// <head>, DEPOIS de js/supabase-client.js e ANTES de
// js/screens/admin-usuarios-modal.js e js/screens/admin-usuarios.js.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.supa (js/supabase-client.js)
//
// NÃO depende de: window.toast, window.navigate, window.CURRENT_USER,
// window.el, window.modal.
//
// Precedente estrutural: mesmo padrão de módulo de write "puro IO" já
// aceito em js/document-link-admin-controller.js / js/screens/
// entrega-writes.js / js/screens/op-writes.js.
// =====================================================================

(function (window) {
  'use strict';

  // -------------------------------------------------------------------
  // Cache local de colunas opcionais — escopado a este módulo, cobre
  // apenas a tabela que esta tela consulta ('usuarios'). Independente
  // do cache equivalente em js/screens/cadastros.js (que cobre também
  // fornecedores/clientes/cores/modelos/precos_terceirizada).
  // -------------------------------------------------------------------
  const OPTIONAL_COLUMN_SUPPORT = {
    usuarios: null,
  };

  async function detectOptionalColumns(table, columns) {
    if (OPTIONAL_COLUMN_SUPPORT[table]) return OPTIONAL_COLUMN_SUPPORT[table];
    const support = {};
    await Promise.all(columns.map(async (column) => {
      const { error } = await window.supa.from(table).select(column);
      support[column] = !error;
    }));
    OPTIONAL_COLUMN_SUPPORT[table] = support;
    return support;
  }

  // -------------------------------------------------------------------
  // Leitura da página (usuários + fornecedores + clientes)
  // -------------------------------------------------------------------

  async function fetchUsuariosPageData(columnSupport) {
    const usuariosSelect = 'id, email, nome, tipo, ativo, desativado_em, fornecedor:fornecedor_id(id, nome, tipo), cliente:cliente_id(id, nome)'
      + (columnSupport.observacoes ? ', observacoes' : '');
    const [usersRes, fornsRes, clientsRes] = await Promise.all([
      window.supa
        .from('usuarios')
        .select(usuariosSelect)
        .order('email'),
      window.supa.from('fornecedores').select('id, nome, tipo').order('nome'),
      window.supa.from('clientes').select('id, nome').order('nome')
    ]);
    return {
      users: usersRes.data || [],
      forns: fornsRes.data || [],
      clients: clientsRes.data || [],
      error: usersRes.error || fornsRes.error || clientsRes.error || null,
    };
  }

  // -------------------------------------------------------------------
  // Leitura — último acesso (RPC admin-only, db/59). Uma chamada por
  // reload() da tela; merge por id fica a cargo do chamador.
  // -------------------------------------------------------------------

  async function fetchLastSignIn() {
    return window.supa.rpc('admin_usuarios_last_sign_in');
  }

  // -------------------------------------------------------------------
  // Writes — criar / editar (PostgREST update em observações)
  // -------------------------------------------------------------------

  async function createUsuario(payload) {
    return window.supa.functions.invoke('admin-create-user', { body: payload });
  }

  async function updateUsuario(id, payload) {
    return window.supa.from('usuarios').update(payload).eq('id', id);
  }

  async function updateUsuarioObservacoes(id, observacoes) {
    return window.supa.from('usuarios').update({ observacoes }).eq('id', id);
  }

  // -------------------------------------------------------------------
  // Writes — desativar / excluir (Edge Functions)
  // -------------------------------------------------------------------

  async function disableUsuario(user_id, reason) {
    return window.supa.functions.invoke('admin-disable-user', { body: { user_id, reason } });
  }

  async function deleteUsuario(user_id, confirm_email) {
    return window.supa.functions.invoke('admin-delete-user', { body: { user_id, confirm_email } });
  }

  // A5.1-A5.2 — reset de senha administrativo. Retorna a senha gerada
  // no envelope de sucesso (data.password) — o chamador exibe uma
  // única vez e nunca a persiste.
  async function resetarSenha(user_id) {
    return window.supa.functions.invoke('admin-reset-user-password', { body: { user_id } });
  }

  // -------------------------------------------------------------------
  // Normalização de erro de Edge Function — extrai {code, message} do
  // corpo estruturado da resposta, com fallback seguro. Mesma lógica
  // repetida 3x no cadastros.js original (create/disable/delete),
  // agora consolidada em um único lugar.
  // -------------------------------------------------------------------

  async function parseEdgeFunctionError(error, fallback) {
    let code = null;
    let message = (error && error.message) ? error.message : fallback;
    try {
      if (error && error.context && typeof error.context.json === 'function') {
        const body = await error.context.json();
        if (body && body.error) {
          code = body.error.code || null;
          if (body.error.message) message = body.error.message;
        }
      }
    } catch (_) { /* ignore body parse errors — mesmo comportamento do original */ }
    return { code, message };
  }

  // Mapeia códigos de erro da Edge Function `admin-disable-user` para
  // mensagens amigáveis em PT-BR. Copiado 1:1 de cadastros.js:82-103.
  function friendlyDisableMessage(code, fallback) {
    switch (code) {
      case 'FORBIDDEN':
        return 'Usuário atual não tem permissão para desativar usuários.';
      case 'SELF_DISABLE_FORBIDDEN':
        return 'Você não pode desativar seu próprio usuário.';
      case 'LAST_ADMIN_FORBIDDEN':
        return 'Não é possível desativar o último admin ativo.';
      case 'NOT_FOUND':
        return 'Usuário não encontrado.';
      case 'AUTH_BAN_FAILED':
        return 'Falha operacional ao banir o usuário. O perfil foi revertido.';
      case 'COMPENSATION_FAILED':
        return 'Falha operacional grave. A reversão do perfil também falhou — reporte ao suporte.';
      case 'VALIDATION_ERROR':
        return 'Dados inválidos para desativação.';
      case 'UNAUTHORIZED':
        return 'Sessão expirada. Faça login novamente.';
      default:
        return fallback || 'Erro ao desativar usuário';
    }
  }

  // Mapeia códigos de erro da Edge Function `admin-delete-user`
  // (hard delete) para mensagens amigáveis em PT-BR. Copiado 1:1 de
  // cadastros.js:108-133.
  function friendlyDeleteMessage(code, fallback) {
    switch (code) {
      case 'FORBIDDEN':
        return 'Usuário atual não tem permissão para excluir usuários.';
      case 'SELF_DELETE_FORBIDDEN':
        return 'Você não pode excluir seu próprio usuário.';
      case 'LAST_ADMIN_FORBIDDEN':
        return 'Não é possível excluir o último admin ativo.';
      case 'NOT_FOUND':
        return 'Usuário não encontrado.';
      case 'CONFIRM_EMAIL_MISMATCH':
        return 'O e-mail digitado não confere com o e-mail do usuário.';
      case 'USER_HAS_REFERENCES':
        return 'Não foi possível remover o perfil: existem registros vinculados no banco. Remova os vínculos antes de excluir.';
      case 'AUTH_DELETE_FAILED':
        return 'Falha operacional ao remover do Auth. O perfil foi restaurado.';
      case 'COMPENSATION_FAILED':
        return 'Falha operacional grave. O perfil e o Auth estão inconsistentes — reporte ao suporte.';
      case 'VALIDATION_ERROR':
        return 'Dados inválidos para exclusão.';
      case 'UNAUTHORIZED':
        return 'Sessão expirada. Faça login novamente.';
      default:
        return fallback || 'Erro ao excluir usuário';
    }
  }

  // Mapeia códigos de erro da Edge Function `admin-reset-user-password`
  // para mensagens amigáveis em PT-BR. Mesmo padrão de
  // friendlyDisableMessage/friendlyDeleteMessage.
  function friendlyResetMessage(code, fallback) {
    switch (code) {
      case 'FORBIDDEN':
        return 'Usuário atual não tem permissão para resetar senha de usuários.';
      case 'SELF_RESET_FORBIDDEN':
        return 'Você não pode resetar a própria senha por aqui — use a tela de troca de senha.';
      case 'NOT_FOUND':
        return 'Usuário não encontrado.';
      case 'AUTH_RESET_FAILED':
        return 'Falha operacional ao resetar a senha no Auth. Nada foi alterado.';
      case 'PROFILE_UPDATE_FAILED':
        return 'A senha já foi alterada, mas houve falha ao atualizar o perfil. Tente resetar novamente.';
      case 'VALIDATION_ERROR':
        return 'Dados inválidos para reset de senha.';
      case 'UNAUTHORIZED':
        return 'Sessão expirada. Faça login novamente.';
      default:
        return fallback || 'Erro ao resetar senha';
    }
  }

  // -------------------------------------------------------------------
  // Namespace
  // -------------------------------------------------------------------

  window.RAVATEX_ADMIN_USUARIOS_WRITES = window.RAVATEX_ADMIN_USUARIOS_WRITES || {};
  window.RAVATEX_ADMIN_USUARIOS_WRITES.detectOptionalColumns = detectOptionalColumns;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.fetchUsuariosPageData = fetchUsuariosPageData;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.fetchLastSignIn = fetchLastSignIn;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.createUsuario = createUsuario;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.updateUsuario = updateUsuario;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.updateUsuarioObservacoes = updateUsuarioObservacoes;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.disableUsuario = disableUsuario;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.deleteUsuario = deleteUsuario;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.resetarSenha = resetarSenha;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.parseEdgeFunctionError = parseEdgeFunctionError;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.friendlyDisableMessage = friendlyDisableMessage;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.friendlyDeleteMessage = friendlyDeleteMessage;
  window.RAVATEX_ADMIN_USUARIOS_WRITES.friendlyResetMessage = friendlyResetMessage;
})(window);
