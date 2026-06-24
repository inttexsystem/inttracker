// =====================================================================
// === supabase/functions/_shared/cors.ts ==============================
// Cabeçalhos CORS compartilhados pelas Edge Functions.
// Mantido simples: permite Authorization, Content-Type e métodos
// necessários. Não versiona segredos.
// =====================================================================

export const corsHeaders: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
