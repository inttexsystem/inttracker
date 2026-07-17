// =====================================================================
// === supabase/functions/admin-reset-user-password/index.ts ===========
// Edge Function: admin-reset-user-password
//
// Reseta a senha de um usuário-alvo para uma senha temporária gerada
// aleatoriamente (via crypto, nunca valor fixo), via
// auth.admin.updateUserById(target_id, { password }). Em sucesso,
// marca public.usuarios.senha_temporaria=true / senha_gerada_em=now()
// no perfil alvo (mesmo caminho de A4.1/A4.2 — o usuário verá o gate
// de troca obrigatória no próximo login). A senha gerada é retornada
// UMA vez na resposta; nunca logada, nunca persistida em texto puro.
//
// Chamada pelo app admin via
// supabase.functions.invoke('admin-reset-user-password', payload).
//
// Espelho do esqueleto de admin-disable-user (guarda admin ativo,
// validação de payload, envelope de resposta) — mas com superfície
// Admin API nova (updateUserById({password}), nunca exercitada antes
// neste repo; ban_duration não é usado aqui).
//
// service_role é lido APENAS de variável de ambiente da Edge
// Function (Deno.env.get). Nunca exposto ao front.
//
// Esta fase NÃO faz deploy. Implementação server-side local no repo.
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
    "admin-reset-user-password: variáveis de ambiente obrigatórias ausentes",
  );
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

// Régua vigente de senha (mesma de A4.1: db/58 + admin-create-user).
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_DIGIT_RE = /[0-9]/;
// Charset sem caracteres visualmente ambíguos (0/O, 1/l/I) — a senha
// é comunicada por um humano (admin) a outro humano (usuário-alvo).
const PASSWORD_CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
const GENERATED_PASSWORD_LENGTH = 12;

// Gera uma senha temporária aleatória via Web Crypto (crypto.getRandomValues
// — nunca Math.random, nunca valor fixo). Garante deterministicamente
// ao menos 1 dígito (a régua exige; não confiar só em probabilidade,
// mesmo que o charset inclua dígitos).
function generateTemporaryPassword(): string {
  const bytes = new Uint8Array(GENERATED_PASSWORD_LENGTH);
  crypto.getRandomValues(bytes);
  let pw = "";
  for (let i = 0; i < GENERATED_PASSWORD_LENGTH; i++) {
    pw += PASSWORD_CHARSET[bytes[i] % PASSWORD_CHARSET.length];
  }
  if (!PASSWORD_DIGIT_RE.test(pw)) {
    const extra = new Uint8Array(2);
    crypto.getRandomValues(extra);
    const digit = String(extra[0] % 10);
    const pos = extra[1] % GENERATED_PASSWORD_LENGTH;
    pw = pw.slice(0, pos) + digit + pw.slice(pos + 1);
  }
  return pw;
}

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
      "Apenas admins ativos podem resetar senha de usuários.",
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

  // Bloquear auto-reset: admin usa o fluxo normal de troca de senha
  // (A4.2, self-service). Evita o footgun de um admin trocar a própria
  // senha por um valor gerado que ele mesmo não escolheu/viu digitar.
  if (targetId === callerId) {
    return errorResponse(
      "SELF_RESET_FORBIDDEN",
      "Admin não pode resetar a própria senha. Use a tela de troca de senha.",
      403,
    );
  }

  // -----------------------------------------------------------------
  // 4. Buscar usuário alvo em public.usuarios
  // -----------------------------------------------------------------
  const { data: targetProfile, error: targetProfileErr } = await adminClient
    .from("usuarios")
    .select("id, email, nome, tipo")
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

  // -----------------------------------------------------------------
  // 5. Gerar senha temporária e resetar no Auth (Admin API)
  // -----------------------------------------------------------------
  const newPassword = generateTemporaryPassword();

  const { error: resetErr } = await adminClient.auth.admin.updateUserById(
    targetId,
    { password: newPassword },
  );

  if (resetErr) {
    // Nada foi alterado em public.usuarios ainda — falha limpa, sem
    // estado parcial.
    return errorResponse(
      "AUTH_RESET_FAILED",
      "Falha ao resetar a senha no Auth.",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 6. Marcar senha_temporaria=true / senha_gerada_em=now() no perfil
  // -----------------------------------------------------------------
  const { error: profileErr } = await adminClient
    .from("usuarios")
    .update({
      senha_temporaria: true,
      senha_gerada_em: new Date().toISOString(),
    })
    .eq("id", targetId);

  if (profileErr) {
    // Estado parcial real: a senha JÁ foi trocada no Auth (a antiga não
    // funciona mais), mas o perfil não foi marcado. Não há compensação
    // segura possível aqui (não é seguro reverter para uma senha
    // anterior desconhecida). Nunca loga a senha gerada — só o
    // identificador do alvo, para correção manual/nova tentativa.
    console.error("admin-reset-user-password: profile update falhou após reset no Auth", {
      targetId,
      profileErr: profileErr.message,
    });
    return errorResponse(
      "PROFILE_UPDATE_FAILED",
      "A senha já foi alterada no Auth, mas houve falha ao atualizar o perfil. " +
        "A senha anterior do usuário não é mais válida. Tente resetar novamente " +
        "(o reset é idempotente e não depende do estado anterior).",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 7. Audit trail (A6.2): explicit insert into public.usuarios_eventos.
  //
  // Placed after both the Auth password reset (step 5) and the
  // profile flag update (step 6) have succeeded — only on this
  // fully-committed success path. This function runs under
  // service_role; trigger_usuario_evento() (db/60) is excluded by
  // its auth.uid() IS NULL guard. ator_id is the caller resolved
  // from the validated JWT (callerId), never auth.uid().
  //
  // payload is intentionally empty: the event type itself
  // (senha_resetada) records that a reset happened, never what it
  // produced — newPassword must NEVER reach usuarios_eventos.payload
  // or any other persisted column, mirroring the function's own
  // "never logged, never persisted in plain text" rule for the
  // generated password.
  //
  // Failure semantics: by this point the reset has fully committed
  // (Auth password changed + profile flagged). An audit-insert
  // failure is logged and flagged in the response, never
  // reversed/blocked — reverting an already-rotated Auth password is
  // not a safe compensation, same reasoning already applied to the
  // pre-existing PROFILE_UPDATE_FAILED path above.
  // -----------------------------------------------------------------
  let auditRecorded = true;
  const { error: auditErr } = await adminClient.from("usuarios_eventos").insert({
    usuario_id: targetProfile.id,
    tipo_evento: "senha_resetada",
    ator_id: callerId,
    payload: {},
    usuario_email: targetProfile.email,
    usuario_nome: targetProfile.nome,
    usuario_tipo: targetProfile.tipo,
  });
  if (auditErr) {
    auditRecorded = false;
    console.error("admin-reset-user-password: audit insert falhou (senha ja resetada, acao permanece valida)", {
      targetId,
      auditErr: auditErr.message,
    });
  }

  return jsonResponse(
    {
      user_id: targetProfile.id,
      email: targetProfile.email,
      tipo: targetProfile.tipo,
      password: newPassword,
      senha_temporaria: true,
      audit_recorded: auditRecorded,
    },
    200,
  );
});
