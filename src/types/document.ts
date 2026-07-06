export type TipoDocumento = 'nf_xml' | 'nf_pdf' | 'romaneio' | 'desconhecido';

export interface RawAttachment {
  gmailMessageId: string;
  threadId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  data: Buffer;
}

export interface DocumentRecord {
  id: string;
  gmailMessageId: string;
  threadId: string;
  attachmentId: string;
  filenameOriginal: string;
  sha256: string;
  tipoDocumento: TipoDocumento;
  localPath: string;
  pedidoManual: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = 'pending' | 'assigned' | 'accepted' | 'rejected';

export function documentStatusFromEvent(s: string): DocumentStatus {
  const map: Record<string, DocumentStatus> = {
    pending_app_acceptance: 'assigned',
    accepted: 'accepted',
    rejected: 'rejected',
  };
  return map[s] ?? 'pending';
}
