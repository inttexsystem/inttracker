// =====================================================================
// === TROCAR SENHA OBRIGATÓRIA — WRITES (Camada 2 — A4.2) ===============
// Write self-service de troca de senha temporária forçada:
//   1. supabase.auth.updateUser({ password }) — self-service, usuário
//      autenticado, SEM Admin API (auth.admin.*).
//   2. Em caso de sucesso, zera usuarios.senha_temporaria via PostgREST
//      (RLS `usuarios_self_update` em public.usuarios permite
//      id = auth.uid() AND ativo IS TRUE, preservando `tipo`; grants
//      de UPDATE em senha_temporaria confirmados para `authenticated`
//      — verificado em staging antes desta fase).
//
// Módulo de write puro, sem DOM/toast — mesmo contrato de
// js/admin-usuarios-writes.js / js/screens/op-writes.js. Toda
// apresentação de erro (mensagem amigável, estado do formulário) fica
// no chamador (js/screens/trocar-senha-obrigatoria.js).
//
// Carregar via <script src="js/trocar-senha-writes.js"></script> no
// <head>, DEPOIS de js/supabase-client.js e ANTES de js/screens/
// trocar-senha-obrigatoria.js e js/boot.js.
//
// Dependências resolvidas em tempo de chamada (não no load):
//   - window.supa (js/supabase-client.js)
//
// NÃO depende de: window.toast, window.CURRENT_USER, window.el.
// =====================================================================

(function (window) {
  'use strict';

  // Retorna { ok: true } em sucesso.
  // Em falha: { ok: false, stage: 'auth' | 'flag', error }.
  // 'auth'  — updateUser({password}) falhou; nada foi alterado.
  // 'flag'  — a senha JÁ foi trocada no Auth, mas o UPDATE que zera
  //           senha_temporaria falhou. Estado parcial real — o chamador
  //           deve reportar isso explicitamente (não é seguro tratar
  //           como sucesso silencioso nem re-tentar o updateUser).
  async function trocarSenhaObrigatoria(userId, novaSenha) {
    const { error: authError } = await window.supa.auth.updateUser({ password: novaSenha });
    if (authError) return { ok: false, stage: 'auth', error: authError };

    const { error: flagError } = await window.supa.from('usuarios')
      .update({ senha_temporaria: false })
      .eq('id', userId);
    if (flagError) return { ok: false, stage: 'flag', error: flagError };

    return { ok: true };
  }

  window.RAVATEX_TROCAR_SENHA_WRITES = window.RAVATEX_TROCAR_SENHA_WRITES || {};
  window.RAVATEX_TROCAR_SENHA_WRITES.trocarSenhaObrigatoria = trocarSenhaObrigatoria;
})(window);
