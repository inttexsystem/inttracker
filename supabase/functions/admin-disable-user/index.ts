// =====================================================================
// === supabase/functions/admin-disable-user/index.ts ===================
// Edge Function: admin-disable-user
//
// Desativa um usuário do app de forma segura, sem hard delete:
//   - marca public.usuarios.ativo = false;
//   - preenche desativado_em / desativado_por / motivo_desativacao;
//   - tenta banir o auth user server-side via
//     auth.admin.updateUserById(user_id, { ban_duration: '876000h' });
//   - em caso de sucesso: retorna estado final;
//   - em caso de falha do ban Auth: tenta compensação simples
//     (reativar perfil) e retorna erro claro.
//
// service_role é lido APENAS de variável de ambiente da Edge
// Function (Deno.env.get). Nunca exposto ao front.
//
// Esta fase NÃO faz deploy. Implementação server-side local no repo.
// Schema correspondente (db/12_auth_user_disable_schema.sql) já
// aplicado em staging por HMNlead no SQL Editor do Dashboard.
// =====================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { corsHeaders } from "../_shared/cors.ts";
import { errorResponse, jsonResponse } from "../_shared/response.ts";

// -------------------------------------------------------------------
// Variáveis de ambiente esperadas (configuradas via `supabase secrets`)
// -------------------------------------------------------------------
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "admin-disable-user: variáveis de ambiente obrigatórias ausentes",
  );
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const REASON_MAX_LENGTH = 500;
const BAN_DURATION = "876000h";

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
  // 1. Validar chamador via JWT no header Authorization
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
  // 2. Verificar que o chamador é admin ATIVO em public.usuarios
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
      "Apenas admins ativos podem desativar usuários.",
      403,
    );
  }

  // -----------------------------------------------------------------
  // 3. Validar payload
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

  let reason: string | null = null;
  if (payload.reason !== undefined && payload.reason !== null) {
    if (typeof payload.reason !== "string") {
      return errorResponse(
        "VALIDATION_ERROR",
        "reason deve ser texto.",
        400,
      );
    }
    const trimmed = payload.reason.trim();
    if (trimmed.length > REASON_MAX_LENGTH) {
      return errorResponse(
        "VALIDATION_ERROR",
        `reason excede o limite de ${REASON_MAX_LENGTH} caracteres.`,
        400,
      );
    }
    reason = trimmed.length > 0 ? trimmed : null;
  }

  // Bloquear auto-desativação
  if (targetId === callerId) {
    return errorResponse(
      "SELF_DISABLE_FORBIDDEN",
      "Admin não pode desativar a si mesmo.",
      403,
    );
  }

  // -----------------------------------------------------------------
  // 4. Buscar usuário alvo em public.usuarios
  // -----------------------------------------------------------------
  const { data: targetProfile, error: targetProfileErr } = await adminClient
    .from("usuarios")
    .select("id, email, nome, tipo, ativo")
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

  // Idempotência: se já está inativo, retornar estado atual sem
  // tentar nova operação nem ban (ban Auth permanece como está).
  if (targetProfile.ativo === false) {
    return jsonResponse({
      user_id: targetProfile.id,
      email: targetProfile.email,
      tipo: targetProfile.tipo,
      ativo: false,
      auth_banned: true,
      already_disabled: true,
    }, 200);
  }

  // -----------------------------------------------------------------
  // 5. Bloquear último admin ativo
  // -----------------------------------------------------------------
  if (targetProfile.tipo === "admin") {
    const { count: activeAdmins, error: adminsErr } = await adminClient
      .from("usuarios")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "admin")
      .eq("ativo", true);

    if (adminsErr) {
      return errorResponse(
        "UNKNOWN",
        "Erro ao contar admins ativos.",
        500,
      );
    }
    if ((activeAdmins ?? 0) <= 1) {
      return errorResponse(
        "LAST_ADMIN_FORBIDDEN",
        "Não é permitido desativar o último admin ativo.",
        403,
      );
    }
  }

  // -----------------------------------------------------------------
  // 6. Soft delete no perfil (public.usuarios)
  // -----------------------------------------------------------------
  const { error: updateErr } = await adminClient
    .from("usuarios")
    .update({
      ativo: false,
      desativado_em: new Date().toISOString(),
      desativado_por: callerId,
      motivo_desativacao: reason,
    })
    .eq("id", targetId);

  if (updateErr) {
    return errorResponse(
      "PROFILE_UPDATE_FAILED",
      "Falha ao desativar perfil.",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 7. Ban Auth (auth.admin.updateUserById com ban_duration)
  //    Se falhar, tentar compensação: reativar o perfil.
  // -----------------------------------------------------------------
  const { error: banErr } = await adminClient.auth.admin.updateUserById(
    targetId,
    { ban_duration: BAN_DURATION },
  );

  if (banErr) {
    // Compensação: tentar reverter o soft delete
    const { error: compErr } = await adminClient
      .from("usuarios")
      .update({
        ativo: true,
        desativado_em: null,
        desativado_por: null,
        motivo_desativacao: null,
      })
      .eq("id", targetId);

    if (compErr) {
      console.error("admin-disable-user: compensação falhou", {
        targetId,
        banErr: banErr.message,
        compErr: compErr.message,
      });
      return errorResponse(
        "COMPENSATION_FAILED",
        "Perfil desativado e ban Auth falhou; compensação também falhou. Requer ação manual.",
        500,
      );
    }

    return errorResponse(
      "AUTH_BAN_FAILED",
      "Falha ao banir usuário no Auth. Perfil revertido para ativo.",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 8. Audit trail (A6.2): explicit insert into public.usuarios_eventos.
  //
  // Placed after both the profile update (step 6) and the Auth ban
  // (step 7) have succeeded — i.e. only on this fully-committed
  // success path. This function runs under service_role;
  // trigger_usuario_evento() (db/60) is excluded by its
  // auth.uid() IS NULL guard, and never fired for the earlier
  // idempotent already-disabled return above either (no state
  // change there, correctly no audit event). ator_id is the caller
  // resolved from the validated JWT (callerId), never auth.uid().
  //
  // Failure semantics: by this point the disable has fully
  // committed (profile + Auth ban). An audit-insert failure is
  // logged and flagged in the response, never reversed/blocked.
  // -----------------------------------------------------------------
  let auditRecorded = true;
  const { error: auditErr } = await adminClient.from("usuarios_eventos").insert({
    usuario_id: targetProfile.id,
    tipo_evento: "usuario_desativado",
    ator_id: callerId,
    payload: { ativo: { de: true, para: false }, motivo: reason },
    usuario_email: targetProfile.email,
    usuario_nome: targetProfile.nome,
    usuario_tipo: targetProfile.tipo,
  });
  if (auditErr) {
    auditRecorded = false;
    console.error("admin-disable-user: audit insert falhou (usuario ja desativado, acao permanece valida)", {
      targetId,
      auditErr: auditErr.message,
    });
  }

  return jsonResponse({
    user_id: targetProfile.id,
    email: targetProfile.email,
    tipo: targetProfile.tipo,
    ativo: false,
    auth_banned: true,
    audit_recorded: auditRecorded,
  }, 200);
});
