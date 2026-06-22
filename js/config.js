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
//   - Produção: bhgifjrfagkzubpyqpew
//   - Staging:  ucrjtfswnfdlxwtmxnoo
// Trocar URL/keys aqui = incidente. Ver docs/STAGING_BASELINE.md.
// =====================================================================

(function (window) {
  'use strict';

  const APP_ENVIRONMENTS = {
    production: {
      name: 'production',
      label: 'PRODUÇÃO',
      supabaseUrl: 'https://bhgifjrfagkzubpyqpew.supabase.co',
      supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJoZ2lmanJmYWdrenVicHlxcGV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkxMTcxMjYsImV4cCI6MjA5NDY5MzEyNn0.5Y94S2QdYNE7Nt5WcvjzkXes1pa3tZgxe3eaWkasya8',
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

  function detectAppEnvironment(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (
      host === 'grupoterrabranca.github.io'
      || host.endsWith('.grupoterrabranca.github.io')
    ) {
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
