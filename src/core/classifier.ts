import type { TipoDocumento } from '../types/document.js';

export interface ClassifyInput {
  filename: string;
  mimeType: string;
  subject?: string;
  contentSample?: string;
}

export function classifyAttachment(input: ClassifyInput): TipoDocumento {
  const name = input.filename.toLowerCase();
  const subj = (input.subject ?? '').toLowerCase();

  if (input.mimeType === 'text/xml' || name.endsWith('.xml')) {
    if (hasNfeStructure(input.contentSample ?? '')) {
      return 'nf_xml';
    }
  }

  if (name.includes('romaneio') || subj.includes('romaneio')) {
    return 'romaneio';
  }

  const nfKeywords = ['nf', 'nfe', 'nota', 'danfe'];
  const nameMatch = nfKeywords.some(k => name.includes(k));
  const subjMatch = nfKeywords.some(k => subj.includes(k));

  if (input.mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    if (nameMatch || subjMatch) {
      return 'nf_pdf';
    }
  }

  return 'desconhecido';
}

function hasNfeStructure(content: string): boolean {
  const lower = content.toLowerCase();
  return lower.includes('<nfe') || lower.includes('<nfe') ||
         lower.includes('nfe') || lower.includes('nfe');
}
