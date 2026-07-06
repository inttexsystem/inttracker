export function normalizePedido(input: string): string | null {
  const trimmed = input.trim().toUpperCase();

  const patterns = [
    /^PED-(\d{2})-(\d{4})$/,
    /^(\d{2})\/(\d{4})$/,
    /^PED\s+(\d{2})\/(\d{4})$/i,
    /^PEDIDO\s+(\d{2})\/(\d{4})$/i,
    /^(\d{2})\/(\d{4})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const num = match[1].padStart(2, '0');
      const year = match[2];
      return `PED-${num}-${year}`;
    }
  }

  const simpleMatch = trimmed.match(/(?:PED[- ]?)?(\d{1,2})[-/](\d{4})/);
  if (simpleMatch) {
    const num = simpleMatch[1].padStart(2, '0');
    const year = simpleMatch[2];
    return `PED-${num}-${year}`;
  }

  return null;
}
