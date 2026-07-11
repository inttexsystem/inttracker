export function maskId(value: string | null | undefined, prefixKeep = 4, suffixKeep = 4): string {
  if (!value) return '';
  if (value.length <= prefixKeep + suffixKeep) return value;
  const start = value.slice(0, prefixKeep);
  const end = value.slice(-suffixKeep);
  const hiddenLen = value.length - prefixKeep - suffixKeep;
  return `${start}${'*'.repeat(Math.max(1, Math.min(hiddenLen, 8)))}${end}`;
}

export function maskIdStrict(value: string | null | undefined, prefixKeep = 3, suffixKeep = 2): string {
  if (!value) return '';
  if (value.length <= prefixKeep + suffixKeep) {
    return value[0] ? `${value[0]}***` : '';
  }
  const start = value.slice(0, prefixKeep);
  const end = value.slice(-suffixKeep);
  const hiddenLen = value.length - prefixKeep - suffixKeep;
  return `${start}${'*'.repeat(Math.max(1, Math.min(hiddenLen, 8)))}${end}`;
}

export function maskEmail(value: string | null | undefined): string {
  if (!value) return '';
  const atIdx = value.indexOf('@');
  if (atIdx < 0) return maskId(value, 2, 2);
  const local = value.slice(0, atIdx);
  const domain = value.slice(atIdx);
  if (local.length < 2) return `${local[0] ?? ''}***${domain}`;
  return `${local.slice(0, 2)}***${domain}`;
}

export function maskSubject(value: string | null | undefined, maxLen = 60): string {
  if (!value) return '';
  if (value.length <= maxLen) return value;
  return value.slice(0, maxLen - 1) + '…';
}

export function maskLink(value: string | null | undefined): string {
  if (!value) return '';
  const match = value.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match) return `https://drive.google.com/file/d/${maskId(match[1])}/view`;
  return maskId(value, 8, 4);
}
