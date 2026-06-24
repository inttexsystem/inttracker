// =====================================================================
// === supabase/functions/admin-delete-user/index.ts ===================
// Edge Function: admin-delete-user
//
// Exclui permanentemente um usuário do app:
//   - remove `public.usuarios` (perfil);
//   - depois remove `auth.users` via `auth.admin.deleteUser`.
//
// NÃO é soft delete (não usa `ativo = false` nem `ban_duration`).
// A ação é destrutiva e exige confirmação por e-mail.
//
// service_role é lido APENAS de variável de ambiente da Edge
// Function (Deno.env.get). Nunca exposto ao front.
//
// Esta fase cria e deploya SOMENTE no ambiente paralelo
// ucrjtfswnfdlxwtmxnoo. Não toca bhgifjrfagkzubpyqpew.
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
    "admin-delete-user: variáveis de ambiente obrigatórias ausentes",
  );
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONFIRM_EMAIL_MAX_LENGTH = 320;

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
      "Apenas admins ativos podem excluir usuários.",
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

  const confirmEmailRaw = typeof payload.confirm_email === "string"
    ? payload.confirm_email.trim()
    : "";
  if (!confirmEmailRaw) {
    return errorResponse(
      "VALIDATION_ERROR",
      "confirm_email obrigatório para confirmar a exclusão.",
      400,
    );
  }
  if (confirmEmailRaw.length > CONFIRM_EMAIL_MAX_LENGTH) {
    return errorResponse(
      "VALIDATION_ERROR",
      "confirm_email excede o limite de caracteres.",
      400,
    );
  }
  if (!EMAIL_RE.test(confirmEmailRaw)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "confirm_email inválido.",
      400,
    );
  }
  const confirmEmail = confirmEmailRaw.toLowerCase();

  // Bloquear autoexclusão
  if (targetId === callerId) {
    return errorResponse(
      "SELF_DELETE_FORBIDDEN",
      "Admin não pode excluir a si mesmo.",
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

  // Exigir confirm_email igual ao email do alvo
  if (String(targetProfile.email || "").toLowerCase() !== confirmEmail) {
    return errorResponse(
      "CONFIRM_EMAIL_MISMATCH",
      "O e-mail digitado não confere com o e-mail do usuário.",
      400,
    );
  }

  // -----------------------------------------------------------------
  // 5. Bloquear exclusão do último admin ativo
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
        "Não é permitido excluir o último admin ativo.",
        403,
      );
    }
  }

  // -----------------------------------------------------------------
  // 6. Remover perfil em public.usuarios primeiro
  //
  // Ordem: FK public.usuarios.id → auth.users.id tem ON DELETE CASCADE,
  // mas a ordem explícita é profile-first para que, se houver
  // referências de outras tabelas (FK em ops/entregas/etc), o erro
  // seja detectado e tratado ANTES de tocar no Auth.
  // -----------------------------------------------------------------
  const { error: profileDelErr } = await adminClient
    .from("usuarios")
    .delete()
    .eq("id", targetId);

  if (profileDelErr) {
    // Provável FK/referência em outra tabela. Não tocar no Auth.
    return errorResponse(
      "USER_HAS_REFERENCES",
      "Não foi possível remover o perfil: existem registros vinculados no banco. Remova os vínculos antes de excluir o usuário.",
      409,
    );
  }

  // -----------------------------------------------------------------
  // 7. Remover Auth user via auth.admin.deleteUser (NÃO usar
  //    updateUserById/ban_duration — esta função é hard delete).
  // -----------------------------------------------------------------
  const { error: authDelErr } = await adminClient.auth.admin.deleteUser(
    targetId,
  );

  if (authDelErr) {
    // Compensação: tentar reinserir o perfil com os dados originais.
    const { error: compErr } = await adminClient
      .from("usuarios")
      .insert({
        id: targetProfile.id,
        email: targetProfile.email,
        nome: targetProfile.nome,
        tipo: targetProfile.tipo,
        ativo: targetProfile.ativo === false ? false : true,
      });

    if (compErr) {
      console.error("admin-delete-user: compensação falhou", {
        targetId,
        authDelErr: authDelErr.message,
        compErr: compErr.message,
      });
      return errorResponse(
        "COMPENSATION_FAILED",
        "Perfil removido, Auth delete falhou, e a reinserção do perfil também falhou. Requer ação manual.",
        500,
      );
    }

    return errorResponse(
      "AUTH_DELETE_FAILED",
      "Perfil removido, mas Auth delete falhou. Perfil foi restaurado.",
      500,
    );
  }

  return jsonResponse({
    ok: true,
    deleted: true,
    user_id: targetProfile.id,
    email: targetProfile.email,
  }, 200);
});
