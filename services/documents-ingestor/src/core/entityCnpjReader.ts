import type { EntityCnpjRegistry, RegisteredEntityCnpj } from '../types/entityCnpj.js';

export interface SupabaseReaderClient {
  from(table: string): {
    select(columns: string): {
      not(column: string, operator: string, value: unknown): PromiseLike<{
        data: unknown[] | null;
        error: { message: string } | null;
      }>;
    };
  };
}

function normalizeCnpj(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/\D/g, '');
}

function sanitizeError(raw: string): string {
  return raw.replace(/\d{10,}/g, (m) => '*'.repeat(m.length));
}

export async function loadRegisteredEntityCnpjs(
  client: SupabaseReaderClient,
): Promise<EntityCnpjRegistry> {
  const [clientesResult, fornecedoresResult] = await Promise.all([
    client.from('clientes').select('id, nome, cnpj').not('cnpj', 'is', null),
    client.from('fornecedores').select('id, nome, tipo, cnpj').not('cnpj', 'is', null),
  ]);

  if (clientesResult.error || fornecedoresResult.error) {
    const raw = clientesResult.error?.message ?? fornecedoresResult.error?.message ?? 'unknown';
    return {
      loaded: false,
      loadedAt: null,
      entries: [],
      error: `entityCnpjReader: ${sanitizeError(raw)}`,
    };
  }

  const entries: RegisteredEntityCnpj[] = [];

  for (const entry of clientesResult.data ?? []) {
    const row = entry as Record<string, unknown>;
    const cnpj = normalizeCnpj(row.cnpj);
    if (cnpj.length !== 14) continue;
    if (typeof row.id !== 'number' || typeof row.nome !== 'string') continue;
    entries.push({
      entityType: 'cliente',
      entityId: row.id,
      entityName: row.nome,
      cnpj,
    });
  }

  for (const entry of fornecedoresResult.data ?? []) {
    const row = entry as Record<string, unknown>;
    const cnpj = normalizeCnpj(row.cnpj);
    if (cnpj.length !== 14) continue;
    if (typeof row.id !== 'number' || typeof row.nome !== 'string') continue;
    entries.push({
      entityType: 'fornecedor',
      entityId: row.id,
      entityName: row.nome,
      cnpj,
      supplierType: typeof row.tipo === 'string' ? row.tipo : undefined,
    });
  }

  return {
    loaded: true,
    loadedAt: new Date().toISOString(),
    entries,
    error: null,
  };
}
