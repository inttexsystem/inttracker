// =====================================================================
// === CONFIG (Seam A) ==================================================
// Detecção de ambiente por hostname + URLs/keys do Supabase por ambiente.
// Carregar via <script src="js/config.js"></script> ANTES do script
// inline principal em index.html. Script CLÁSSICO (não ES module):
// expõe os identificadores como globais (window.*) para preservar a
// compatibilidade com o script inline que já usava
// `APP_ENVIRONMENTS / APP_ENV / APP_CONFIG / SUPABASE_URL / SUPABASE_ANON_KEY`.
//
// Fonte de verdade do ref (INTTRACKER-PRODUCTION-CUTOVER-R1):
//   - Produção DEFINITIVA: ucrjtfswnfdlxwtmxnoo — é o único projeto
//     Supabase com o schema corrente (56 tabelas públicas, incluindo todo
//     o domínio ordem_compra da trilha PURCHASE_ORDER_PHASE_C) e com os
//     usuários e pedidos reais.
//   - O projeto gqmpsxkxynrjvidfmojk foi RETIRADO de todo papel de
//     runtime. Ele está ACTIVE_HEALTHY, mas 16 tabelas atrás e sem
//     nenhuma tabela de ordem de compra, logo NÃO é um destino
//     não-produtivo válido. Não é produção, não é staging e não é
//     fallback. Não deve reaparecer em configuração ativa.
//
// NÃO EXISTE BANCO NÃO-PRODUTIVO VÁLIDO. Por isso o ambiente
// não-produtivo NÃO recebe um banco separado: ele resolve para o MESMO
// projeto de produção, porém marcado como SOMENTE LEITURA
// (`writesEnabled: false`). js/supabase-client.js consome essa flag e
// bloqueia insert/update/delete/upsert/rpc, preservando reads e login.
// Isso satisfaz a regra de que localhost e previews nunca escrevem em
// produção — e, principalmente, nunca escrevem em SILÊNCIO: o bloqueio
// é explícito, logado e sinalizado por banner.
//
// Regime de chaves: a anon key legada (JWT) de ucrjtfswnfdlxwtmxnoo é a
// chave publicável ativa do projeto (verificada: disabled=false). É a
// mesma para os dois ambientes porque o projeto é o mesmo; a diferença
// entre eles é permissão de escrita, não credencial.
//
// Detecção por hostname: só os domínios de produção da Vercel abaixo
// resolvem para "production"; localhost e QUALQUER outro host (incluindo
// preview deployments *.vercel.app) resolvem para "restricted" — default
// seguro, ver docs/reports/PRODUCTION_READINESS_DIAGNOSIS_R1_2026-07-17.md.
//
// Trocar URL/keys aqui = incidente. A fonte canônica do roteamento é
// docs/governance/current-state.json (environment_boundaries) e a entrada
// INTTRACKER-PRODUCTION-CUTOVER-R1 em docs/ledgers/G28_LEDGER.md.
// NÃO consultar docs/STAGING_BASELINE.md nem docs/DEPLOYMENT.md para isto:
// ambos são documentos de checkpoint históricos, anteriores a este cutover,
// e ainda descrevem `bhgifjrfagkzubpyqpew` como produção — hoje esse é o
// projeto PROIBIDO.
// =====================================================================

(function (window) {
  'use strict';

  // Projeto Supabase de produção — ref único e definitivo.
  const PRODUCTION_SUPABASE_URL = 'https://ucrjtfswnfdlxwtmxnoo.supabase.co';
  const PRODUCTION_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjcmp0ZnN3bmZkbHh3dG14bm9vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNzQ5OTMsImV4cCI6MjA5NzY1MDk5M30.4y41y8w8l4VElfQUQ_QpIp4zOW1n5za-1_ekyv_v6aw';

  const APP_ENVIRONMENTS = {
    production: {
      name: 'production',
      label: 'PRODUÇÃO',
      supabaseUrl: PRODUCTION_SUPABASE_URL,
      supabaseAnonKey: PRODUCTION_SUPABASE_ANON_KEY,
      isProduction: true,
      // Único ambiente com permissão de escrita.
      writesEnabled: true,
    },
    // Ambiente não-produtivo: localhost, previews da Vercel e qualquer
    // host desconhecido. Aponta para o MESMO banco porque não existe um
    // banco não-produtivo válido, mas SEM permissão de escrita.
    restricted: {
      name: 'restricted',
      label: 'PRODUÇÃO — SOMENTE LEITURA',
      supabaseUrl: PRODUCTION_SUPABASE_URL,
      supabaseAnonKey: PRODUCTION_SUPABASE_ANON_KEY,
      isProduction: false,
      writesEnabled: false,
    },
  };

  // Domínios de produção da Vercel (match exato). Qualquer outro host —
  // incluindo localhost e preview deployments *.vercel.app — cai em
  // "restricted" por padrão (fail-safe: preview nunca escreve em prod).
  //
  // A branch de produção do projeto Vercel `inttex/inttracker` é `dev`,
  // então o alias de branch de produção é `inttracker-git-dev-inttex`.
  // `inttracker-git-main-inttex` foi REMOVIDO: com a branch de produção
  // em `dev`, qualquer deploy de `main` é PREVIEW e não pode escrever.
  //
  // FORWARD CORRECTION (INTTRACKER-PRODUCTION-CUTOVER-ALIAS-...-R1): a lista
  // tinha DOIS dos TRÊS aliases que a Vercel atribui de fato a um deploy de
  // produção. `inttracker-inttex.vercel.app` ficou de fora e por isso caía no
  // ambiente `restricted`: a aplicação carregava e lia normalmente, mas toda
  // escrita era bloqueada naquele domínio. A falha era na direção segura, e
  // por isso silenciosa. A lista agora vem dos aliases REAIS do deployment,
  // nunca de derivação a partir do nome da branch.
  const PRODUCTION_HOSTNAMES = [
    'inttracker-jade.vercel.app',
    'inttracker-inttex.vercel.app',
    'inttracker-git-dev-inttex.vercel.app',
  ];

  function detectAppEnvironment(hostname) {
    const host = String(hostname || '').toLowerCase();
    if (PRODUCTION_HOSTNAMES.indexOf(host) !== -1) {
      return 'production';
    }
    return 'restricted';
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
    PRODUCTION_HOSTNAMES,
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
  window.PRODUCTION_HOSTNAMES = PRODUCTION_HOSTNAMES;
  window.detectAppEnvironment = detectAppEnvironment;
  window.APP_ENV = APP_ENV;
  window.APP_CONFIG = APP_CONFIG;
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
})(window);
