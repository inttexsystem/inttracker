// ============================================================
// G25-B2-A-R3 — Smoke write de Parceiros/CNPJ.
//
// INTTRACKER-STAGING-AND-BACKUP-ENVIRONMENT-SAFETY-R1 — fail closed.
// Este smoke ESCREVE (INSERT/DELETE em parceiros e parceiro_cnpjs) e so
// pode operar contra um ambiente nao-produtivo isolado. Esse ambiente
// NAO existe: ucrjtfswnfdlxwtmxnoo e a PRODUCAO definitiva,
// gqmpsxkxynrjvidfmojk foi RETIRADO (nao e producao, staging,
// development nem fallback) e bhgifjrfagkzubpyqpew e PROIBIDO. O
// caminho real de execucao esta desativado deterministicamente, antes
// de qualquer leitura de credencial ou fetch; o proposito futuro do
// smoke permanece visivel no codigo.
//
// Fluxo:
//   1. login admin (signInWithPassword);
//   2. contagens ANTES de parceiros/parceiro_cnpjs;
//   3. cria parceiro sintético (__smoke_r3_<ts>) + CNPJ de teste
//      matematicamente válido reservado (11222333000181);
//   4. valida contagens DEPOIS;
//   5. valida normalização (sem pontuação) + RLS admin-only;
//   6. cleanup integral (delete CNPJ + parceiro);
//   7. confirma contagens voltaram ao estado anterior.
//
// Nenhum dado real é usado. Não usa service role.
// ============================================================
import fs from 'node:fs';
import path from 'node:path';

const PRODUCTION_REF = 'ucrjtfswnfdlxwtmxnoo';
const RETIRED_REF = 'gqmpsxkxynrjvidfmojk';
const FORBIDDEN_REF = 'bhgifjrfagkzubpyqpew';
const NONPRODUCTION_ENVIRONMENT_UNAVAILABLE = 'INTTEX_NONPRODUCTION_ENVIRONMENT_UNAVAILABLE';

// Nao existe variavel de ambiente, flag de CLI, prompt oculto ou override
// generico que libere o caminho de escrita em producao.
function refuseNonProductionEnvironmentUnavailable() {
  console.error(NONPRODUCTION_ENVIRONMENT_UNAVAILABLE);
  console.error('Este smoke exige um ambiente nao-produtivo isolado.');
  console.error('Nenhum ambiente nao-produtivo valido existe atualmente.');
  console.error('O projeto configurado (' + PRODUCTION_REF + ') e PRODUCAO.');
  console.error('Mutacao em producao nao e autorizada por este smoke.');
  console.error('Projeto retirado: ' + RETIRED_REF + '; projeto proibido: ' + FORBIDDEN_REF + '.');
  process.exit(3);
}

// Fail closed ANTES de ler a config local (credenciais), criar client,
// abrir browser ou emitir qualquer fetch.
refuseNonProductionEnvironmentUnavailable();

const CFG = JSON.parse(fs.readFileSync(
  path.resolve('.ravatex-local/admin-disable-user-e2e.config.json'), 'utf8'));

const URL = CFG.supabaseUrl;
const ANON = CFG.anonKey;
const EMAIL = CFG.adminEmail;
const PASS = CFG.adminPassword;

async function rest(pathname, accessToken, method, body) {
  const res = await fetch(URL + pathname, {
    method,
    headers: {
      apikey: ANON,
      Authorization: 'Bearer ' + accessToken,
      'Content-Type': 'application/json',
      Prefer: method === 'POST' ? 'return=representation' : 'return=minimal',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* keep null */ }
  return { ok: res.ok, status: res.status, json, text };
}

async function login() {
  const res = await fetch(URL + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  if (!res.ok) throw new Error('login falhou: ' + res.status + ' ' + await res.text());
  const data = await res.json();
  return data.access_token;
}

async function countRows(accessToken, table, filter) {
  // HEAD com Prefer: count=exact para obter o total via header content-range.
  const q = table + (filter ? '?' + filter : '');
  const res = await fetch(URL + '/rest/v1/' + q, {
    method: 'GET',
    headers: {
      apikey: ANON,
      Authorization: 'Bearer ' + accessToken,
      Range: '0-0',
      Prefer: 'count=exact',
      Select: 'id',
    },
  });
  const range = res.headers.get('content-range') || '';
  // content-range: "0-0/123" → total = 123
  const total = range.split('/')[1];
  return Number(total);
}

const TS = Date.now();
const NOME_SMOKE = '__smoke_r3_' + TS;
const CNPJ_TESTE = '11222333000181'; // válido, reservado ao teste (verify.sql)

async function main() {
  console.log('[1] login admin em staging', URL.replace('https://', ''));
  const token = await login();
  console.log('    access_token obtido (Bearer [REDACTED])');

  console.log('[2] contagens ANTES');
  const parceirosAntes = await countRows(token, 'parceiros');
  const cnpjsAntes = await countRows(token, 'parceiro_cnpjs');
  console.log('    parceiros:', parceirosAntes, '| parceiro_cnpjs:', cnpjsAntes);

  console.log('[3] cria parceiro sintético:', NOME_SMOKE);
  const insPar = await rest('/rest/v1/parceiros', token, 'POST', {
    nome: NOME_SMOKE, ativo: true,
  });
  if (!insPar.ok) { console.error('    FAIL insert parceiro:', insPar.status, insPar.text); throw new Error('insert parceiro falhou'); }
  const parceiroId = insPar.json && insPar.json[0] && insPar.json[0].id;
  if (!parceiroId) { console.error('    sem id retornado:', insPar.text); throw new Error('sem parceiro id'); }
  console.log('    parceiro criado id:', parceiroId);

  console.log('[4] cria CNPJ de teste (normalizado, sem pontuação):', CNPJ_TESTE);
  const insCnpj = await rest('/rest/v1/parceiro_cnpjs', token, 'POST', {
    parceiro_id: parceiroId, cnpj: CNPJ_TESTE, principal: true, ativo: true,
  });
  if (!insCnpj.ok) { console.error('    FAIL insert cnpj:', insCnpj.status, insCnpj.text); throw new Error('insert cnpj falhou'); }
  console.log('    CNPJ criado');

  console.log('[5] contagens DEPOIS');
  const parceirosDepois = await countRows(token, 'parceiros');
  const cnpjsDepois = await countRows(token, 'parceiro_cnpjs');
  console.log('    parceiros:', parceirosDepois, '| parceiro_cnpjs:', cnpjsDepois);

  if (parceirosDepois !== parceirosAntes + 1) throw new Error('parceiros não subiu +1');
  if (cnpjsDepois !== cnpjsAntes + 1) throw new Error('parceiro_cnpjs não subiu +1');
  console.log('    OK: +1 parceiro, +1 CNPJ');

  console.log('[6] valida normalização: CNPJ gravado sem pontuação');
  const getCnpj = await rest('/rest/v1/parceiro_cnpjs?cnpj=eq.' + CNPJ_TESTE + '&select=cnpj', token, 'GET');
  if (!getCnpj.ok || !getCnpj.json || getCnpj.json.length === 0) throw new Error('CNPJ não encontrado após insert');
  const gravado = getCnpj.json[0].cnpj;
  if (gravado !== CNPJ_TESTE || /\D/.test(gravado)) {
    throw new Error('CNPJ gravado com pontuação ou divergente: ' + gravado);
  }
  console.log('    OK: gravado como', gravado);

  console.log('[7] cleanup integral');
  // Deleta CNPJ primeiro (FK), depois parceiro.
  const delCnpj = await rest('/rest/v1/parceiro_cnpjs?cnpj=eq.' + CNPJ_TESTE, token, 'DELETE');
  if (!delCnpj.ok) { console.error('    FAIL delete cnpj:', delCnpj.status, delCnpj.text); throw new Error('delete cnpj falhou'); }
  console.log('    CNPJ de teste removido');
  const delPar = await rest('/rest/v1/parceiros?id=eq.' + parceiroId, token, 'DELETE');
  if (!delPar.ok) { console.error('    FAIL delete parceiro:', delPar.status, delPar.text); throw new Error('delete parceiro falhou'); }
  console.log('    parceiro de teste removido');

  console.log('[8] contagens FINAIS (devem igular as ANTES)');
  const parceirosFinal = await countRows(token, 'parceiros');
  const cnpjsFinal = await countRows(token, 'parceiro_cnpjs');
  console.log('    parceiros:', parceirosFinal, '| parceiro_cnpjs:', cnpjsFinal);
  if (parceirosFinal !== parceirosAntes) throw new Error('parceiros não voltou ao estado anterior: ' + parceirosFinal + ' vs ' + parceirosAntes);
  if (cnpjsFinal !== cnpjsAntes) throw new Error('parceiro_cnpjs não voltou ao estado anterior: ' + cnpjsFinal + ' vs ' + cnpjsAntes);
  console.log('    OK: estado restaurado');

  console.log('\nSMOKE PASSED — staging limpo, estado anterior restaurado.');
}

main().catch((e) => {
  console.error('\nSMOKE FAILED:', e.message);
  process.exit(1);
});
