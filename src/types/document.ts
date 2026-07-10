export type TipoDocumento = 'nf' | 'romaneio' | 'desconhecido';

export type TipoDocumentoLegado = 'nf_xml' | 'nf_pdf' | 'romaneio' | 'desconhecido';

export type FormatoDocumento = 'pdf' | 'xml' | 'desconhecido';

export type DirecaoNF = 'entrada' | 'saida' | 'desconhecida';

export type StorageBackend = 'google_drive';

export interface DocumentoTaxonomia {
  tipoDocumento: TipoDocumento;
  formato: FormatoDocumento;
  direcaoNf: DirecaoNF | null;
}

export function fromLegacyTipo(tipo: TipoDocumento | TipoDocumentoLegado): DocumentoTaxonomia {
  switch (tipo) {
    case 'nf_xml':
      return { tipoDocumento: 'nf', formato: 'xml', direcaoNf: 'desconhecida' };
    case 'nf_pdf':
      return { tipoDocumento: 'nf', formato: 'pdf', direcaoNf: 'desconhecida' };
    case 'nf':
      return { tipoDocumento: 'nf', formato: 'pdf', direcaoNf: 'desconhecida' };
    case 'romaneio':
      return { tipoDocumento: 'romaneio', formato: 'pdf', direcaoNf: null };
    case 'desconhecido':
      return { tipoDocumento: 'desconhecido', formato: 'desconhecido', direcaoNf: null };
  }
}

export function toLegacyTipo(input: {
  tipoDocumento: TipoDocumento;
  formato: FormatoDocumento;
}): TipoDocumentoLegado {
  if (input.tipoDocumento === 'nf') {
    if (input.formato === 'xml') return 'nf_xml';
    return 'nf_pdf';
  }
  return input.tipoDocumento as TipoDocumentoLegado;
}

export function formatoFromMimeType(mimeType: string): FormatoDocumento {
  if (mimeType === 'text/xml' || mimeType === 'application/xml') return 'xml';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'desconhecido';
}

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
  senderEmail: string | null;
  emailMessageId: string | null;
  emailReceivedAt: string | null;
  emailReceivedAtSource: 'gmail_internal_date' | 'header_date' | null;
  emailReceivedAtEstimated: boolean;
  tipoDocumento: TipoDocumento;
  formato?: FormatoDocumento;
  direcaoNf?: DirecaoNF | null;

  storageBackend: StorageBackend;
  storageUri?: string;
  driveFileId?: string;
  driveFolderId?: string;
  driveWebViewLink?: string;
  driveWebContentLink?: string;

  localCachePath?: string;
  localPath?: string;

  pedidoManual: string | null;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus = 'pending' | 'assigned' | 'accepted' | 'rejected';

export function buildStorageUri(driveFileId: string): string {
  return `gdrive://file/${driveFileId}`;
}

export function documentStatusFromEvent(s: string): DocumentStatus {
  const map: Record<string, DocumentStatus> = {
    pending_app_acceptance: 'assigned',
    accepted: 'accepted',
    rejected: 'rejected',
  };
  return map[s] ?? 'pending';
}
