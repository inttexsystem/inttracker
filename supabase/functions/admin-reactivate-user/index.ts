// =====================================================================
// === supabase/functions/admin-reactivate-user/index.ts ================
// Edge Function: admin-reactivate-user
//
// Symmetric counterpart of admin-disable-user. Reactivates a previously
// disabled user:
//   - guards target exists and is currently inactive
//     (REACTIVATE_NOT_INACTIVE otherwise);
//   - sets public.usuarios.ativo = true;
//   - clears desativado_em / desativado_por / motivo_desativacao;
//   - lifts the Auth ban via
//     auth.admin.updateUserById(user_id, { ban_duration: 'none' });
//   - on success: returns final state;
//   - on Auth unban failure: compensates by restoring the previous
//     inactive state (original desativado_em/desativado_por/
//     motivo_desativacao) and returns a clear error.
//
// service_role is read ONLY from an Edge Function environment variable
// (Deno.env.get). Never exposed to the front-end.
//
// This phase does NOT deploy. Local server-side implementation in the
// repo only. Deploy is executed by the architect, outside the
// credential reach of this session.
// =====================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";

// -------------------------------------------------------------------
// Expected environment variables (configured via `supabase secrets`)
// -------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "admin-reactivate-user: variáveis de ambiente obrigatórias ausentes",
  );
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const UNBAN_DURATION = "none";

serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(
      "VALIDATION_ERROR",
      "Método não permitido (apenas POST).",
      400,
    );
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse(
      "UNKNOWN",
      "Configuração da função incompleta.",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 1. Validate caller via JWT in the Authorization header
  // -----------------------------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) {
    return errorResponse("UNAUTHORIZED", "Token ausente.", 401);
  }

  const callerClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userErr } = await callerClient.auth.getUser(
    token,
  );
  if (userErr || !userData?.user) {
    return errorResponse("UNAUTHORIZED", "Sessão inválida.", 401);
  }
  const callerId = userData.user.id;

  // -----------------------------------------------------------------
  // 2. Verify caller is an ACTIVE admin in public.usuarios
  // -----------------------------------------------------------------
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: callerProfileErr } = await adminClient
    .from("usuarios")
    .select("id, tipo, ativo")
    .eq("id", callerId)
    .maybeSingle();

  if (callerProfileErr) {
    return errorResponse(
      "UNKNOWN",
      "Erro ao verificar perfil do chamador.",
      500,
    );
  }
  if (
    !callerProfile ||
    callerProfile.tipo !== "admin" ||
    callerProfile.ativo !== true
  ) {
    return errorResponse(
      "FORBIDDEN",
      "Apenas admins ativos podem reativar usuários.",
      403,
    );
  }

  // -----------------------------------------------------------------
  // 3. Validate payload
  // -----------------------------------------------------------------
  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return errorResponse("VALIDATION_ERROR", "JSON inválido.", 400);
  }

  const targetIdRaw = typeof payload.user_id === "string"
    ? payload.user_id.trim()
    : "";
  if (!targetIdRaw) {
    return errorResponse("VALIDATION_ERROR", "user_id obrigatório.", 400);
  }
  if (!UUID_RE.test(targetIdRaw)) {
    return errorResponse("VALIDATION_ERROR", "user_id inválido (UUID).", 400);
  }
  const targetId = targetIdRaw.toLowerCase();

  // Self-reactivation guard: moot in practice (an active caller can
  // never be its own inactive target — an inactive user is banned and
  // cannot hold a valid session), but guarded anyway for symmetry with
  // admin-disable-user's SELF_DISABLE_FORBIDDEN.
  if (targetId === callerId) {
    return errorResponse(
      "SELF_REACTIVATE_FORBIDDEN",
      "Admin não pode reativar a si mesmo.",
      403,
    );
  }

  // -----------------------------------------------------------------
  // 4. Fetch target user in public.usuarios
  // -----------------------------------------------------------------
  const { data: targetProfile, error: targetProfileErr } = await adminClient
    .from("usuarios")
    .select("id, email, nome, tipo, ativo, desativado_em, desativado_por, motivo_desativacao")
    .eq("id", targetId)
    .maybeSingle();

  if (targetProfileErr) {
    return errorResponse(
      "UNKNOWN",
      "Erro ao buscar usuário alvo.",
      500,
    );
  }
  if (!targetProfile) {
    return errorResponse("NOT_FOUND", "Usuário não encontrado.", 404);
  }

  // Guard: target must currently be inactive. Reactivating an already
  // active user is a caller error, not an idempotent no-op — unlike
  // admin-disable-user, there is no ambiguous "already reactivated"
  // state to collapse into.
  if (targetProfile.ativo !== false) {
    return errorResponse(
      "REACTIVATE_NOT_INACTIVE",
      "Usuário não está inativo.",
      409,
    );
  }

  // Preserve the previous inactive state for compensation if the Auth
  // unban step below fails.
  const previousDesativadoEm = targetProfile.desativado_em;
  const previousDesativadoPor = targetProfile.desativado_por;
  const previousMotivoDesativacao = targetProfile.motivo_desativacao;

  // -----------------------------------------------------------------
  // 5. Reactivate the profile (public.usuarios)
  // -----------------------------------------------------------------
  const { error: updateErr } = await adminClient
    .from("usuarios")
    .update({
      ativo: true,
      desativado_em: null,
      desativado_por: null,
      motivo_desativacao: null,
    })
    .eq("id", targetId);

  if (updateErr) {
    return errorResponse(
      "PROFILE_UPDATE_FAILED",
      "Falha ao reativar perfil.",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 6. Lift Auth ban (auth.admin.updateUserById with ban_duration: 'none')
  //    On failure, compensate by restoring the previous inactive state.
  // -----------------------------------------------------------------
  const { error: unbanErr } = await adminClient.auth.admin.updateUserById(
    targetId,
    { ban_duration: UNBAN_DURATION },
  );

  if (unbanErr) {
    const { error: compErr } = await adminClient
      .from("usuarios")
      .update({
        ativo: false,
        desativado_em: previousDesativadoEm,
        desativado_por: previousDesativadoPor,
        motivo_desativacao: previousMotivoDesativacao,
      })
      .eq("id", targetId);

    if (compErr) {
      console.error("admin-reactivate-user: compensação falhou", {
        targetId,
        unbanErr: unbanErr.message,
        compErr: compErr.message,
      });
      return errorResponse(
        "COMPENSATION_FAILED",
        "Perfil reativado e remoção do ban Auth falhou; compensação também falhou. Requer ação manual.",
        500,
      );
    }

    return errorResponse(
      "AUTH_UNBAN_FAILED",
      "Falha ao remover o ban no Auth. Perfil revertido para inativo.",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 7. Audit trail (A6.2): explicit insert into public.usuarios_eventos.
  //
  // Placed after both the profile update (step 5) and the Auth
  // unban (step 6) have succeeded — only on this fully-committed
  // success path, symmetric with admin-disable-user. This function
  // runs under service_role; trigger_usuario_evento() (db/60) is
  // excluded by its auth.uid() IS NULL guard. ator_id is the caller
  // resolved from the validated JWT (callerId), never auth.uid().
  //
  // Failure semantics: by this point the reactivation has fully
  // committed (profile + Auth unban). An audit-insert failure is
  // logged and flagged in the response, never reversed/blocked.
  // -----------------------------------------------------------------
  let auditRecorded = true;
  const { error: auditErr } = await adminClient.from("usuarios_eventos").insert({
    usuario_id: targetProfile.id,
    tipo_evento: "usuario_reativado",
    ator_id: callerId,
    payload: { ativo: { de: false, para: true } },
    usuario_email: targetProfile.email,
    usuario_nome: targetProfile.nome,
    usuario_tipo: targetProfile.tipo,
  });
  if (auditErr) {
    auditRecorded = false;
    console.error("admin-reactivate-user: audit insert falhou (usuario ja reativado, acao permanece valida)", {
      targetId,
      auditErr: auditErr.message,
    });
  }

  return jsonResponse({
    user_id: targetProfile.id,
    email: targetProfile.email,
    tipo: targetProfile.tipo,
    ativo: true,
    auth_banned: false,
    audit_recorded: auditRecorded,
  }, 200);
});
