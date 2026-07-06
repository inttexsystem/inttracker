-- emails_processados: rastreia quais mensagens já foram varridas
CREATE TABLE IF NOT EXISTS emails_processados (
  gmail_message_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  processed_at TEXT NOT NULL DEFAULT (datetime('now')),
  scan_status TEXT NOT NULL DEFAULT 'processed'
    CHECK (scan_status IN ('processed', 'skipped', 'error')),
  attachments_count INTEGER NOT NULL DEFAULT 0
);

-- documentos: cada anexo baixado
CREATE TABLE IF NOT EXISTS documentos (
  id TEXT PRIMARY KEY,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  attachment_id TEXT NOT NULL,
  filename_original TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'desconhecido'
    CHECK (tipo_documento IN ('nf_xml', 'nf_pdf', 'romaneio', 'desconhecido')),
  local_path TEXT NOT NULL,
  pedido_manual TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'accepted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (gmail_message_id) REFERENCES emails_processados(gmail_message_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_dedup
  ON documentos(gmail_message_id, attachment_id, sha256);

-- ingestion_events: eventos gerados no outbox JSONL
CREATE TABLE IF NOT EXISTS ingestion_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'document.detected',
  pedido_manual TEXT NOT NULL,
  document_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_app_acceptance'
    CHECK (status IN ('pending_app_acceptance', 'accepted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  exported_at TEXT,
  FOREIGN KEY (document_id) REFERENCES documentos(id)
);

CREATE INDEX IF NOT EXISTS idx_events_exported
  ON ingestion_events(exported_at);
