'use strict';

// =====================================================================
// === tests/admin-usuarios-audit-read-model.test.js ====================
// Pure unit of the A6.3 user-audit read model. No DOM, no network.
// =====================================================================

const test = require('node:test');
const assert = require('node:assert/strict');
const audit = require('../js/admin-usuarios-audit-read-model.js');

const { AUDIT_STATE, ICON_KEY } = audit.constants;

const ATOR_ID = '11111111-1111-4111-8111-111111111111';
const SUBJ_ID = '22222222-2222-4222-8222-222222222222';

function evt(over) {
  return Object.assign({
    id: 1, tipo_evento: 'perfil_alterado', ator_id: ATOR_ID,
    payload: { ativo: { de: true, para: false } },
    criado_em: '2026-07-16T10:30:00Z',
    usuario_id: SUBJ_ID, usuario_email: 'target@tapetes.test', usuario_nome: 'Target User', usuario_tipo: 'fornecedor',
    ator_email: 'admin@tapetes.test', ator_nome: 'Admin User',
  }, over || {});
}

test('exposes buildUsuarioAuditTrail and constants', function () {
  assert.equal(typeof audit.buildUsuarioAuditTrail, 'function');
  assert.equal(AUDIT_STATE.AVAILABLE, 'available');
  assert.equal(ICON_KEY.CREATED, 'created');
});

test('loading state via options.loading', function () {
  const r = audit.buildUsuarioAuditTrail(null, { loading: true });
  assert.equal(r.state, AUDIT_STATE.LOADING);
  assert.deepEqual(r.entries, []);
});

test('unavailable state on non-array input (fail-closed)', function () {
  assert.equal(audit.buildUsuarioAuditTrail(null).state, AUDIT_STATE.UNAVAILABLE);
  assert.equal(audit.buildUsuarioAuditTrail(undefined).state, AUDIT_STATE.UNAVAILABLE);
  assert.equal(audit.buildUsuarioAuditTrail('not-an-array').state, AUDIT_STATE.UNAVAILABLE);
  assert.equal(audit.buildUsuarioAuditTrail({ ok: false }).state, AUDIT_STATE.UNAVAILABLE);
});

test('empty state on zero events', function () {
  const r = audit.buildUsuarioAuditTrail([]);
  assert.equal(r.state, AUDIT_STATE.EMPTY);
  assert.deepEqual(r.entries, []);
});

test('available state orders newest-first (criado_em desc, ties by id desc)', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ id: 1, criado_em: '2026-07-16T10:00:00Z' }),
    evt({ id: 3, criado_em: '2026-07-16T12:00:00Z' }),
    evt({ id: 2, criado_em: '2026-07-16T12:00:00Z' }),
  ]);
  assert.equal(r.state, AUDIT_STATE.AVAILABLE);
  assert.deepEqual(r.entries.map((e) => e.id), [3, 2, 1]);
});

// -----------------------------------------------------------------------
// Five tipo_evento mappings (A6.2 explicit inserts) + perfil_alterado
// (trigger) — all six must map to a distinct action label + icon key.
// -----------------------------------------------------------------------

test('usuario_criado: action label, icon key, payload phrase', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'usuario_criado', payload: { tipo: 'cliente', fornecedor_id: null, cliente_id: 7 } }),
  ]);
  const e = r.entries[0];
  assert.equal(e.actionLabel, 'Usuário criado');
  assert.equal(e.iconKey, ICON_KEY.CREATED);
  assert.match(e.detailLine, /tipo: cliente/);
  assert.match(e.detailLine, /cliente #7/);
});

test('usuario_desativado: action label, icon key, payload phrase (ativo + motivo)', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'usuario_desativado', payload: { ativo: { de: true, para: false }, motivo: 'teste' } }),
  ]);
  const e = r.entries[0];
  assert.equal(e.actionLabel, 'Usuário desativado');
  assert.equal(e.iconKey, ICON_KEY.DISABLED);
  assert.match(e.detailLine, /ativo: sim → não/);
  assert.match(e.detailLine, /motivo: teste/);
});

test('usuario_desativado sem motivo: payload phrase não menciona "motivo:"', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'usuario_desativado', payload: { ativo: { de: true, para: false } } }),
  ]);
  assert.doesNotMatch(r.entries[0].detailLine, /motivo:/);
});

test('usuario_reativado: action label, icon key, payload phrase', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'usuario_reativado', payload: { ativo: { de: false, para: true } } }),
  ]);
  const e = r.entries[0];
  assert.equal(e.actionLabel, 'Usuário reativado');
  assert.equal(e.iconKey, ICON_KEY.REACTIVATED);
  assert.match(e.detailLine, /ativo: não → sim/);
});

test('senha_resetada: action label, icon key, payload NUNCA aparece na linha de detalhe (nem vazio {})', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'senha_resetada', payload: {} }),
  ]);
  const e = r.entries[0];
  assert.equal(e.actionLabel, 'Senha resetada');
  assert.equal(e.iconKey, ICON_KEY.RESET);
  assert.doesNotMatch(e.detailLine.toLowerCase(), /password|senha temporaria gerada pelo admin.*[a-z0-9]{6,}/);
  assert.equal(e.detailLine, 'senha temporária gerada');
});

test('usuario_excluido: action label, icon key, static detail phrase', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'usuario_excluido', payload: {}, usuario_id: null }),
  ]);
  const e = r.entries[0];
  assert.equal(e.actionLabel, 'Usuário excluído');
  assert.equal(e.iconKey, ICON_KEY.EXCLUDED);
  assert.equal(e.detailLine, 'perfil excluído permanentemente');
});

test('perfil_alterado: action label, icon key, formats boolean and string field changes', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'perfil_alterado', payload: { ativo: { de: true, para: false }, tipo: { de: 'admin', para: 'cliente' } } }),
  ]);
  const e = r.entries[0];
  assert.equal(e.actionLabel, 'Perfil alterado');
  assert.equal(e.iconKey, ICON_KEY.CHANGED);
  assert.match(e.detailLine, /ativo: sim → não/);
  assert.match(e.detailLine, /tipo: admin → cliente/);
});

test('tipo_evento desconhecido: nunca lança, cai em rótulo/ícone defensivos', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'algo_futuro_nao_mapeado', payload: { x: 1 } }),
  ]);
  const e = r.entries[0];
  assert.equal(e.actionLabel, 'Evento desconhecido');
  assert.equal(e.iconKey, ICON_KEY.UNKNOWN);
  assert.match(e.detailLine, /evento não reconhecido/);
});

// -----------------------------------------------------------------------
// NULL usuario_id + identity snapshot (db/61 delete-survival) rendering
// -----------------------------------------------------------------------

test('usuario_id NULL: subjectOrphaned=true, não lança, rótulo/detalhe seguem normais', function () {
  const r = audit.buildUsuarioAuditTrail([
    evt({ tipo_evento: 'usuario_excluido', payload: {}, usuario_id: null, usuario_email: 'gone@tapetes.test', usuario_nome: 'Gone User', usuario_tipo: 'fornecedor' }),
  ]);
  const e = r.entries[0];
  assert.equal(e.subjectOrphaned, true);
  assert.equal(e.actionLabel, 'Usuário excluído');
});

test('usuario_id presente: subjectOrphaned=false', function () {
  const r = audit.buildUsuarioAuditTrail([evt({ usuario_id: SUBJ_ID })]);
  assert.equal(r.entries[0].subjectOrphaned, false);
});

// -----------------------------------------------------------------------
// Actor line
// -----------------------------------------------------------------------

test('actorLine: nome + email quando ambos resolvidos', function () {
  const r = audit.buildUsuarioAuditTrail([evt({ ator_email: 'a@b.com', ator_nome: 'Fulano' })]);
  assert.equal(r.entries[0].actorLine, 'por Fulano (a@b.com)');
});

test('actorLine: apenas email quando nome ausente', function () {
  const r = audit.buildUsuarioAuditTrail([evt({ ator_email: 'a@b.com', ator_nome: null })]);
  assert.equal(r.entries[0].actorLine, 'por a@b.com');
});

test('actorLine: fallback quando ator_id ausente (evento de sistema)', function () {
  const r = audit.buildUsuarioAuditTrail([evt({ ator_id: null, ator_email: null, ator_nome: null })]);
  assert.equal(r.entries[0].actorLine, 'por sistema');
});

test('actorLine: fallback quando ator_id presente mas não resolvido (admin removido)', function () {
  const r = audit.buildUsuarioAuditTrail([evt({ ator_id: ATOR_ID, ator_email: null, ator_nome: null })]);
  assert.equal(r.entries[0].actorLine, 'por administrador (perfil removido)');
});

// -----------------------------------------------------------------------
// Timestamp format (dd/MM HH:mm)
// -----------------------------------------------------------------------

test('timestampLabel: formata dd/MM HH:mm a partir de criado_em ISO', function () {
  const r = audit.buildUsuarioAuditTrail([evt({ criado_em: '2026-01-05T09:07:00Z' })]);
  assert.match(r.entries[0].timestampLabel, /^\d{2}\/\d{2} \d{2}:\d{2}$/);
});

test('timestampLabel: null em timestamp ausente/inválido, nunca lança nem mostra "Invalid Date"', function () {
  const r1 = audit.buildUsuarioAuditTrail([evt({ criado_em: null })]);
  assert.equal(r1.entries[0].timestampLabel, null);
  const r2 = audit.buildUsuarioAuditTrail([evt({ criado_em: 'not-a-date' })]);
  assert.equal(r2.entries[0].timestampLabel, null);
});

// -----------------------------------------------------------------------
// No writes, no DOM
// -----------------------------------------------------------------------

test('módulo não referencia document/window.supa/fetch (puro)', function () {
  const fs = require('node:fs');
  const path = require('node:path');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin-usuarios-audit-read-model.js'), 'utf8');
  assert.doesNotMatch(src, /\bdocument\./);
  assert.doesNotMatch(src, /window\.supa/);
  assert.doesNotMatch(src, /\bfetch\(/);
});
