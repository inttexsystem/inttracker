export type EventStatus = 'pending_app_acceptance' | 'accepted' | 'rejected';

export type StorageBackend = 'google_drive';

export interface DocumentEventDocument {
  document_id: string;
  tipo_documento: string;
  filename_original: string;
  sha256: string;

  storage_backend: StorageBackend;
  storage_uri: string;
  drive_file_id: string;
  drive_folder_id?: string;
  drive_web_view_link?: string;
  drive_web_content_link?: string;

  local_cache_path?: string;

  manifest_storage_uri?: string;

  reason?: string;

  formato?: string;
  direcao_nf?: string;
}

export interface DocumentEvent {
  schema_version: 1 | 2;
  event_type: string;
  event_id: string;
  ingestion_event_id?: string;
  created_at: string;
  pedido_manual: string;
  source: 'gmail';
  gmail_message_id: string;
  thread_id: string;
  document: DocumentEventDocument;
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
  driveFileId: string;
  driveFolderId?: string;
  driveWebViewLink?: string;
  driveWebContentLink?: string;
  localCachePath?: string;
  manifestStorageUri?: string;
  status?: EventStatus;
  formato?: string;
  direcaoNf?: string;
  eventType?: string;
}): DocumentEvent {
  const document: DocumentEventDocument = {
    document_id: params.documentId,
    tipo_documento: params.tipoDocumento,
    filename_original: params.filenameOriginal,
    sha256: params.sha256,
    storage_backend: 'google_drive',
    storage_uri: `gdrive://file/${params.driveFileId}`,
    drive_file_id: params.driveFileId,
    drive_folder_id: params.driveFolderId,
    drive_web_view_link: params.driveWebViewLink,
    drive_web_content_link: params.driveWebContentLink,
    local_cache_path: params.localCachePath,
    manifest_storage_uri: params.manifestStorageUri,
  };
  if (params.formato) {
    document.formato = params.formato;
  }
  if (params.direcaoNf) {
    document.direcao_nf = params.direcaoNf;
  }
  return {
    schema_version: 1,
    event_type: params.eventType ?? 'document.detected',
    event_id: params.eventId,
    created_at: new Date().toISOString(),
    pedido_manual: params.pedidoManual,
    source: 'gmail',
    gmail_message_id: params.gmailMessageId,
    thread_id: params.threadId,
    document,
    status: params.status ?? 'pending_app_acceptance',
  };
}
