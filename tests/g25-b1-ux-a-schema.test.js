'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migrationPath = path.resolve(__dirname, '..', 'db', '43_document_sender_email.sql');
const migration = fs.readFileSync(migrationPath, 'utf8');

test('G25-B1-UX-A: migration adiciona sender_email e atualiza o writer canonico', function () {
  assert.match(migration, /ADD\s+COLUMN\s+IF\s+NOT\s+EXISTS\s+sender_email\s+TEXT/i);
  assert.match(migration, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.upsert_document_candidate_ingestor_state/i);
  assert.match(migration, /v_sender_email\s*:=\s*lower\(NULLIF\(btrim\(v_input\.sender_email\),\s*''\)\)/i);
  assert.match(migration, /sender_email\s*=\s*COALESCE\(v_existing\.sender_email,\s*v_sender_email\)/i);
  assert.match(migration, /raw_payload,\s*sender_email/i);
  assert.match(migration, /v_sender_email,\s*\n\s*v_input\.email_message_id/i);
});
