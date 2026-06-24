// =====================================================================
// === AUTH (Seam A) ====================================================
// Sessão e perfil do usuário autenticado. Concentra:
//   - login(email, senha)               — signIn + load profile
//   - logout()                          — signOut + clear + navigate
//   - loadCurrentUser()                 — getSession + load profile (data-access)
//   - CURRENT_USER (singleton mutável)  — estado global via getter/setter
//
// Carregar via <script src="js/auth.js"></script> no <head>, DEPOIS de
// js/environment-banner.js e ANTES do script inline principal que
// consome CURRENT_USER nas telas e no router.
//
// Dependências (fornecidas pelo <head> em ordem):
//   - window.supa (js/supabase-client.js)   — client Supabase + write-guard
//   - window.APP_ENV (js/config.js)         — usado indiretamente por telas
//   - window.navigate (inline, router)      — resolvido em tempo de clique
//                                             (hoisting resolve)
//
// Compatibilidade: o script inline e as telas continuam lendo/escrevendo
// window.CURRENT_USER, window.login, window.logout, window.loadCurrentUser
// exatamente como antes. CURRENT_USER é exposto via Object.defineProperty
// para preservar a semântica de "let" reatribuível globalmente.
// =====================================================================

(function (window) {
  'use strict';

  // Tipos canônicos. Exportados em RAVATEX_AUTH para consumidores novos;
  // o inline pode continuar usando literais de string (já fazia isso).
  const USER_ROLES = {
    ADMIN: 'admin',
    FORNECEDOR: 'fornecedor',
    CLIENTE: 'cliente',
  };
  const FORNECEDOR_SUBTIPOS = {
    FIO_ALGODAO: 'fio_algodao',
    FIO_POLIESTER: 'fio_poliester',
    TECELAGEM: 'tecelagem',
    LATEX: 'latex',
  };

  // Estado singleton (mutável in-place; reatribuível via setter).
  let _currentUser = null;

  Object.defineProperty(window, 'CURRENT_USER', {
    get() {
      return _currentUser;
    },
    set(value) {
      _currentUser = value;
    },
    configurable: true,
    enumerable: true,
  });

  // -------------------------------------------------------------------
  // Auth actions
  // -------------------------------------------------------------------

  async function login(email, senha) {
    const { data, error } = await window.supa.auth.signInWithPassword({
      email,
      password: senha,
    });
    if (error) throw error;
    await loadCurrentUser();
    return data.user;
  }

  async function logout() {
    await window.supa.auth.signOut();
    // Atribuição via setter (mantém referência em _currentUser).
    window.CURRENT_USER = null;
    // window.navigate é resolvido em tempo de clique. No momento do
    // load deste módulo, navigate ainda não existe (será declarada
    // depois pelo script inline do router). Funciona por hoisting +
    // resolução tardia: o `window.navigate(...)` só roda quando o
    // user clica no botão "Sair", momento em que o inline já foi
    // executado.
    window.navigate('#/login');
  }

  async function loadCurrentUser() {
    const { data: { session } } = await window.supa.auth.getSession();
    if (!session) {
      window.CURRENT_USER = null;
      return null;
    }
    const { data, error } = await window.supa.from('usuarios')
      .select('id, email, nome, tipo, fornecedor_id, cliente_id, fornecedores:fornecedor_id(tipo), clientes:cliente_id(nome)')
      .eq('id', session.user.id)
      .single();
    if (error) {
      console.error('Erro carregando perfil:', error);
      window.CURRENT_USER = null;
      return null;
    }
    window.CURRENT_USER = data;
    // Cacheia fornecedor_tipo e cliente_nome no próprio CURRENT_USER (mutação in-place).
    window.CURRENT_USER.fornecedor_tipo = data.fornecedores?.tipo || null;
    window.CURRENT_USER.cliente_nome = data.clientes?.nome || null;
    return data;
  }

  // -------------------------------------------------------------------
  // Helpers de conveniência
  // -------------------------------------------------------------------

  function getCurrentUser() {
    return _currentUser;
  }

  function setCurrentUser(value) {
    window.CURRENT_USER = value;
  }

  function isAdmin() {
    return _currentUser != null && _currentUser.tipo === USER_ROLES.ADMIN;
  }

  function isFornecedor() {
    return _currentUser != null && _currentUser.tipo === USER_ROLES.FORNECEDOR;
  }

  function isCliente() {
    return _currentUser != null && _currentUser.tipo === USER_ROLES.CLIENTE;
  }

  // -------------------------------------------------------------------
  // Namespace principal
  // -------------------------------------------------------------------

  window.RAVATEX_AUTH = {
    USER_ROLES,
    FORNECEDOR_SUBTIPOS,
    getCurrentUser,
    setCurrentUser,
    isAdmin,
    isFornecedor,
    isCliente,
    login,
    logout,
    loadCurrentUser,
  };

  // Compatibilidade com o script inline atual.
  window.login = login;
  window.logout = logout;
  window.loadCurrentUser = loadCurrentUser;
})(window);
