// =====================================================================
// === CONFIG (Seam A) ==================================================
// Detecção de ambiente por hostname + URLs/keys do Supabase por ambiente.
// Carregar via <script src="js/config.js"></script> ANTES do script
// inline principal em index.html. Script CLÁSSICO (não ES module):
// expõe os identificadores como globais (window.*) para preservar a
// compatibilidade com o script inline que já usava
// `APP_ENVIRONMENTS / APP_ENV / APP_CONFIG / SUPABASE_URL / SUPABASE_ANON_KEY`.
//
// Fonte de verdade dos refs:
//   - Produção: gqmpsxkxynrjvidfmojk (novo projeto, live na Vercel)
//   - Staging:  ucrjtfswnfdlxwtmxnoo (projeto legado, mantido como registro
//               histórico por decisão M3; NÃO apagar)
// Regime de chaves (nota, não "corrigir" aqui): produção usa a chave
// sb_publishable_ já presente no arquivo (formato novo); staging usa a
// anon JWT legada recuperada do histórico do git (formato antigo). A
// convivência dos dois formatos é intencional nesta fase — ver relatório
// de fechamento do commit "Restore environment split in config".
// Detecção por hostname: só os domínios de produção da Vercel abaixo
// resolvem para "production"; localhost e QUALQUER outro host (incluindo
// preview deployments *.vercel.app) resolvem para "staging" — default
// seguro, ver docs/reports/PRODUCTION_READINESS_DIAGNOSIS_R1_2026-07-17.md.
// Trocar URL/keys aqui = incidente. Ver docs/STAGING_BASELINE.md.
// =====================================================================

(function (window) {
  'use strict';

  const APP_ENVIRONMENTS = {
    production: {
      name: 'production',
      label: 'PRODUÇÃO',
      supabaseUrl: 'https://gqmpsxkxynrjvidfmojk.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdxbXBzeGt4eW5yanZpZGZtb2prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQyOTcxODIsImV4cCI6MjA5OTg3MzE4Mn0.7LvcJ-zkJQGgXLoGn2AMNpj2u6EFETU_8n_GlmY5kC0',
      isProduction: true,
    },
    staging: {
      name: 'staging',
      label: 'STAGING',
      supabaseUrl: 'https://ucrjtfswnfdlxwtmxnoo.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcmp0ZnN3bmZkbHh3dG14bm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNzQ5OTMsImV4cCI6MjA5NzY1MDk5M30.4y41y8w8l4VElfQUQ_QpIp4zOW1n5za-1_ekyv_v6aw',
      isProduction: false,
    },
  };

  // Domínios de produção da Vercel (match exato). Qualquer outro host —
  // incluindo localhost e preview deployments *.vercel.app — cai em
  // staging por padrão (fail-safe: preview nunca deve escrever em prod).
  const PRODUCTION_HOSTNAMES = [
    'inttracker-jade.vercel.app',
    'inttracker-git-main-inttex.vercel.app',
  ];

  function detectAppEnvironment(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (PRODUCTION_HOSTNAMES.indexOf(host) !== -1) {
      return 'production';
    }
    return 'staging';
  }

  const _hostname = (typeof window !== 'undefined' && window.location)
    ? window.location.hostname
    : '';
  const APP_ENV = detectAppEnvironment(_hostname);
  const APP_CONFIG = APP_ENVIRONMENTS[APP_ENV];

  const SUPABASE_URL = APP_CONFIG.supabaseUrl;
  const SUPABASE_ANON_KEY = APP_CONFIG.supabaseAnonKey;

  // Namespace única e estável para consumidores novos.
  window.RAVATEX_CONFIG = {
    APP_ENVIRONMENTS,
    detectAppEnvironment,
    APP_ENV,
    APP_CONFIG,
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
  };

  // Compatibilidade com o script inline atual (que já referencia esses
  // identificadores como globais). Mantemos os mesmos nomes para que a
  // extração seja literalmente um "move", sem precisar editar usos.
  window.APP_ENVIRONMENTS = APP_ENVIRONMENTS;
  window.detectAppEnvironment = detectAppEnvironment;
  window.APP_ENV = APP_ENV;
  window.APP_CONFIG = APP_CONFIG;
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
})(window);
