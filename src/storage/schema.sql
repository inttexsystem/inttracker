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

-- documentos: cada anexo detectado.
-- O armazenamento canônico é Google Drive (storage_backend='google_drive').
-- local_cache_path é apenas cache/mirror local, nunca fonte canônica.
-- local_path é mantido apenas para compatibilidade com scaffold anterior
-- e representa cache local, não a fonte de verdade.
-- Taxonomia G1: tipo_documento aceita novo (nf/romaneio/desconhecido) e legado (nf_xml/nf_pdf).
CREATE TABLE IF NOT EXISTS documentos (
  id TEXT PRIMARY KEY,
  gmail_message_id TEXT NOT NULL,
  thread_id TEXT NOT NULL DEFAULT '',
  attachment_id TEXT NOT NULL,
  filename_original TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  sender_email TEXT,
  email_message_id TEXT,
  email_received_at TEXT,
  email_received_at_source TEXT
    CHECK (email_received_at_source IS NULL OR email_received_at_source IN ('gmail_internal_date', 'header_date')),
  email_received_at_estimated INTEGER NOT NULL DEFAULT 0
    CHECK (email_received_at_estimated IN (0, 1)),
  tipo_documento TEXT NOT NULL DEFAULT 'desconhecido'
    CHECK (tipo_documento IN ('nf', 'romaneio', 'desconhecido', 'nf_xml', 'nf_pdf')),

  formato TEXT NOT NULL DEFAULT 'desconhecido'
    CHECK (formato IN ('pdf', 'xml', 'desconhecido')),

  direcao_nf TEXT
    CHECK (direcao_nf IS NULL OR direcao_nf IN ('entrada', 'saida', 'desconhecida')),

  cnpj_emitente TEXT,
  cnpj_destinatario TEXT,

  -- Storage canônico (Drive-first)
  storage_backend TEXT NOT NULL DEFAULT 'google_drive'
    CHECK (storage_backend IN ('google_drive')),
  storage_uri TEXT,
  drive_file_id TEXT,
  drive_folder_id TEXT,
  drive_web_view_link TEXT,
  drive_web_content_link TEXT,

  -- Cache local (não-canônico)
  local_cache_path TEXT,
  local_path TEXT,

  pedido_manual TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'assigned', 'accepted', 'rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (gmail_message_id) REFERENCES emails_processados(gmail_message_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_documentos_dedup
  ON documentos(gmail_message_id, attachment_id, sha256);

CREATE INDEX IF NOT EXISTS idx_documentos_drive_file_id
  ON documentos(drive_file_id);

-- ingestion_events: eventos gerados no outbox JSONL.
-- Carregam referências Drive (storage_uri, drive_file_id, manifest_storage_uri).
CREATE TABLE IF NOT EXISTS ingestion_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'document.detected',
  pedido_manual TEXT NOT NULL,
  document_id TEXT NOT NULL,

  -- Referência Drive
  storage_backend TEXT NOT NULL DEFAULT 'google_drive',
  storage_uri TEXT,
  drive_file_id TEXT,
  drive_web_view_link TEXT,
  manifest_storage_uri TEXT,
  manifest_drive_file_id TEXT,

  status TEXT NOT NULL DEFAULT 'pending_app_acceptance'
    CHECK (status IN ('pending_app_acceptance', 'accepted', 'rejected')),
  reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  exported_at TEXT,
  FOREIGN KEY (document_id) REFERENCES documentos(id)
);

CREATE INDEX IF NOT EXISTS idx_events_exported
  ON ingestion_events(exported_at);
