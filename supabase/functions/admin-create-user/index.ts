// =====================================================================
// === supabase/functions/admin-create-user/index.ts ===================
// Edge Function: admin-create-user
//
// Cria, de forma atômica e compensada, um usuário em Supabase Auth
// e o perfil correspondente em public.usuarios. Chamada pelo app
// admin via supabase.functions.invoke('admin-create-user', payload).
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
    "admin-create-user: variáveis de ambiente obrigatórias ausentes",
  );
}

const ALLOWED_TIPOS = new Set(["admin", "fornecedor", "cliente"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_DIGIT_RE = /[0-9]/;

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
  // 2. Verificar que o chamador é admin em public.usuarios
  // -----------------------------------------------------------------
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: callerProfile, error: profileErr } = await adminClient
    .from("usuarios")
    .select("id, tipo")
    .eq("id", callerId)
    .maybeSingle();

  if (profileErr) {
    return errorResponse(
      "UNKNOWN",
      "Erro ao verificar perfil do chamador.",
      500,
    );
  }
  if (!callerProfile || callerProfile.tipo !== "admin") {
    return errorResponse(
      "FORBIDDEN",
      "Apenas admins podem criar usuários.",
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

  const emailRaw = typeof payload.email === "string" ? payload.email.trim() : "";
  const email = emailRaw.toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return errorResponse("VALIDATION_ERROR", "E-mail inválido.", 400);
  }

  const password = typeof payload.password === "string" ? payload.password : "";
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return errorResponse(
      "VALIDATION_ERROR",
      `Senha temporária obrigatória (mínimo ${PASSWORD_MIN_LENGTH} caracteres).`,
      400,
    );
  }
  if (!PASSWORD_DIGIT_RE.test(password)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Senha temporária deve conter ao menos 1 dígito.",
      400,
    );
  }

  const nome = typeof payload.nome === "string" ? payload.nome.trim() : "";
  if (!nome) {
    return errorResponse("VALIDATION_ERROR", "Nome obrigatório.", 400);
  }

  const tipo = typeof payload.tipo === "string" ? payload.tipo : "";
  if (!ALLOWED_TIPOS.has(tipo)) {
    return errorResponse(
      "VALIDATION_ERROR",
      "Tipo deve ser 'admin', 'fornecedor' ou 'cliente'.",
      400,
    );
  }

  let fornecedorId: number | null = null;
  let clienteId: number | null = null;

  if (tipo === "admin") {
    const rawForn = payload.fornecedor_id;
    if (rawForn !== null && rawForn !== undefined && rawForn !== "") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Usuário admin não pode ter fornecedor_id.",
        400,
      );
    }
    const rawCli = payload.cliente_id;
    if (rawCli !== null && rawCli !== undefined && rawCli !== "") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Usuário admin não pode ter cliente_id.",
        400,
      );
    }
  } else if (tipo === "fornecedor") {
    const rawCli = payload.cliente_id;
    if (rawCli !== null && rawCli !== undefined && rawCli !== "") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Usuário fornecedor não pode ter cliente_id.",
        400,
      );
    }
    const rawForn = payload.fornecedor_id;
    if (rawForn === null || rawForn === undefined || rawForn === "") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Usuário fornecedor precisa de fornecedor_id.",
        400,
      );
    }
    const nForn = Number(rawForn);
    if (!Number.isInteger(nForn) || nForn <= 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        "fornecedor_id inválido.",
        400,
      );
    }
    const { data: forn, error: fornErr } = await adminClient
      .from("fornecedores")
      .select("id")
      .eq("id", nForn)
      .maybeSingle();
    if (fornErr) {
      return errorResponse("UNKNOWN", "Erro ao validar fornecedor.", 500);
    }
    if (!forn) {
      return errorResponse(
        "VALIDATION_ERROR",
        "fornecedor_id não existe em public.fornecedores.",
        400,
      );
    }
    fornecedorId = nForn;
  } else {
    // tipo === "cliente"
    const rawForn = payload.fornecedor_id;
    if (rawForn !== null && rawForn !== undefined && rawForn !== "") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Usuário cliente não pode ter fornecedor_id.",
        400,
      );
    }
    const rawCli = payload.cliente_id;
    if (rawCli === null || rawCli === undefined || rawCli === "") {
      return errorResponse(
        "VALIDATION_ERROR",
        "Usuário cliente precisa de cliente_id.",
        400,
      );
    }
    const nCli = Number(rawCli);
    if (!Number.isInteger(nCli) || nCli <= 0) {
      return errorResponse(
        "VALIDATION_ERROR",
        "cliente_id inválido.",
        400,
      );
    }
    const { data: cli, error: cliErr } = await adminClient
      .from("clientes")
      .select("id")
      .eq("id", nCli)
      .maybeSingle();
    if (cliErr) {
      return errorResponse("UNKNOWN", "Erro ao validar cliente.", 500);
    }
    if (!cli) {
      return errorResponse(
        "VALIDATION_ERROR",
        "cliente_id não existe em public.clientes.",
        400,
      );
    }
    clienteId = nCli;
  }

  // -----------------------------------------------------------------
  // 4. Criar auth user (service_role server-side)
  // -----------------------------------------------------------------
  const { data: created, error: createErr } = await adminClient.auth.admin
    .createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome, tipo, fornecedor_id: fornecedorId, cliente_id: clienteId },
    });

  if (createErr || !created?.user) {
    const msg = (createErr?.message ?? "").toLowerCase();
    if (
      msg.includes("already") ||
      msg.includes("exists") ||
      msg.includes("registered")
    ) {
      return errorResponse("CONFLICT", "E-mail já cadastrado.", 409);
    }
    return errorResponse(
      "AUTH_CREATE_FAILED",
      "Falha ao criar usuário de autenticação.",
      500,
    );
  }

  const newUserId: string = created.user.id;

  // -----------------------------------------------------------------
  // 5. Inserir perfil em public.usuarios
  // -----------------------------------------------------------------
  const { error: insertErr } = await adminClient.from("usuarios").insert({
    id: newUserId,
    email,
    nome,
    tipo,
    fornecedor_id: fornecedorId,
    cliente_id: clienteId,
    senha_temporaria: true,
    senha_gerada_em: new Date().toISOString(),
  });

  if (insertErr) {
    // Compensação: remover o auth user recém-criado
    const { error: delErr } = await adminClient.auth.admin.deleteUser(
      newUserId,
    );
    if (delErr) {
      console.error("admin-create-user: compensação falhou", {
        newUserId,
        delErr: delErr.message,
      });
      return errorResponse(
        "COMPENSATION_FAILED",
        "Falha ao criar perfil e remover auth user. user_id=" + newUserId,
        500,
      );
    }
    return errorResponse(
      "PROFILE_INSERT_FAILED",
      "Falha ao criar perfil.",
      500,
    );
  }

  // -----------------------------------------------------------------
  // 6. Audit trail (A6.2): explicit insert into public.usuarios_eventos.
  //
  // This function runs under service_role — trigger_usuario_evento()
  // (db/60) is excluded by its auth.uid() IS NULL guard, so nothing
  // records this action automatically. This insert is the sole
  // recorder. ator_id is the caller resolved from the validated JWT
  // above (callerId), never auth.uid() (NULL in this context anyway).
  //
  // Failure semantics: by this point auth user + profile have both
  // committed successfully. An audit-insert failure is logged and
  // flagged in the response (audit_recorded: false), but never
  // reverses or blocks an already-successful admin action.
  // -----------------------------------------------------------------
  let auditRecorded = true;
  const { error: auditErr } = await adminClient.from("usuarios_eventos").insert({
    usuario_id: newUserId,
    tipo_evento: "usuario_criado",
    ator_id: callerId,
    payload: { tipo, fornecedor_id: fornecedorId, cliente_id: clienteId },
    usuario_email: email,
    usuario_nome: nome,
    usuario_tipo: tipo,
  });
  if (auditErr) {
    auditRecorded = false;
    console.error("admin-create-user: audit insert falhou (usuario ja criado, acao permanece valida)", {
      newUserId,
      auditErr: auditErr.message,
    });
  }

  return jsonResponse(
    {
      user_id: newUserId,
      email,
      tipo,
      fornecedor_id: fornecedorId,
      cliente_id: clienteId,
      audit_recorded: auditRecorded,
    },
    201,
  );
});
