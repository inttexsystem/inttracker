export type EventStatus = 'pending_app_acceptance' | 'accepted' | 'rejected';

export interface DocumentEvent {
  schema_version: 1;
  event_type: 'document.detected';
  event_id: string;
  created_at: string;
  pedido_manual: string;
  source: 'gmail';
  gmail_message_id: string;
  thread_id: string;
  document: {
    document_id: string;
    tipo_documento: string;
    filename_original: string;
    sha256: string;
    local_path: string;
    manifest_path: string;
  };
  status: EventStatus;
}

export function createDocumentEvent(params: {
  eventId: string;
  pedidoManual: string;
  gmailMessageId: string;
  threadId: string;
  documentId: string;
  tipoDocumento: string;
  filenameOriginal: string;
  sha256: string;
  localPath: string;
  manifestPath: string;
  status?: EventStatus;
}): DocumentEvent {
  return {
    schema_version: 1,
    event_type: 'document.detected',
    event_id: params.eventId,
    created_at: new Date().toISOString(),
    pedido_manual: params.pedidoManual,
    source: 'gmail',
    gmail_message_id: params.gmailMessageId,
    thread_id: params.threadId,
    document: {
      document_id: params.documentId,
      tipo_documento: params.tipoDocumento,
      filename_original: params.filenameOriginal,
      sha256: params.sha256,
      local_path: params.localPath,
      manifest_path: params.manifestPath,
    },
    status: params.status ?? 'pending_app_acceptance',
  };
}
