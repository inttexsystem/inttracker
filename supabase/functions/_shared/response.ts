// =====================================================================
// === supabase/functions/_shared/response.ts ==========================
// Helpers de resposta JSON padronizadas para as Edge Functions.
// Envelopes:
//   sucesso: { "data": ... }
//   erro:    { "error": { "code": ..., "message": ... } }
// Não retorna segredos, stack traces ou detalhes internos.
// =====================================================================

import { corsHeaders } from "./cors.ts";

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function errorResponse(
  code: string,
  message: string,
  status: number,
): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
