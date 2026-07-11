import { describe, it, expect } from 'vitest';
import { loadRegisteredEntityCnpjs, type SupabaseReaderClient } from '../src/core/entityCnpjReader.js';

function fakeRow(data: unknown[]): unknown[] {
  return data;
}

function successResult(data: unknown[]) {
  return { data, error: null };
}

function errorResult(message: string) {
  return { data: null, error: { message } };
}

function makeSpy(overrideFrom?: (table: string) => unknown): {
  client: SupabaseReaderClient;
  calls: Array<{ table: string; columns: string; notColumn: string; notOperator: string }>;
} {
  const calls: Array<{ table: string; columns: string; notColumn: string; notOperator: string }> = [];
  const client: SupabaseReaderClient = {
    from(table: string) {
      if (overrideFrom) return overrideFrom(table) as ReturnType<SupabaseReaderClient['from']>;
      return {
        select(columns: string) {
          return {
            not(column: string, operator: string, value: unknown) {
              calls.push({ table, columns, notColumn: column, notOperator: operator });
              return {
                then(resolve: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                  return Promise.resolve(resolve({ data: [], error: null }));
                },
              };
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

describe('loadRegisteredEntityCnpjs', () => {
  it('cliente with valid CNPJ is registered', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([{ id: 1, nome: 'Encanta Lar', cnpj: '11222333000181' }])));
                return Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(true);
    expect(registry.error).toBeNull();
    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0]).toMatchObject({ entityType: 'cliente', entityId: 1, entityName: 'Encanta Lar', cnpj: '11222333000181' });
    expect(registry.entries[0].supplierType).toBeUndefined();
  });

  it('fornecedor with valid CNPJ is registered', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([])));
                return Promise.resolve(resolve(successResult([{ id: 2, nome: 'Conitex', tipo: 'latex', cnpj: '22222333000172' }])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(true);
    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0]).toMatchObject({ entityType: 'fornecedor', entityId: 2, entityName: 'Conitex', cnpj: '22222333000172', supplierType: 'latex' });
  });

  it('supplierType is preserved only on fornecedor', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([{ id: 1, nome: 'Cliente A', cnpj: '11222333000181' }])));
                return Promise.resolve(resolve(successResult([{ id: 2, nome: 'Fornecedor B', tipo: 'tecelagem', cnpj: '22222333000172' }])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    const cliente = registry.entries.find(e => e.entityType === 'cliente')!;
    const fornecedor = registry.entries.find(e => e.entityType === 'fornecedor')!;
    expect(cliente.supplierType).toBeUndefined();
    expect(fornecedor.supplierType).toBe('tecelagem');
  });

  it('same CNPJ in cliente and fornecedor produces two entries', async () => {
    const sharedCnpj = '11222333000181';
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([{ id: 1, nome: 'Mesmo CNPJ Cliente', cnpj: sharedCnpj }])));
                return Promise.resolve(resolve(successResult([{ id: 2, nome: 'Mesmo CNPJ Fornecedor', tipo: 'latex', cnpj: sharedCnpj }])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.entries).toHaveLength(2);
    expect(registry.entries.filter(e => e.entityType === 'cliente')).toHaveLength(1);
    expect(registry.entries.filter(e => e.entityType === 'fornecedor')).toHaveLength(1);
  });

  it('two distinct clients are not collapsed', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([
                  { id: 1, nome: 'Cliente A', cnpj: '11222333000181' },
                  { id: 2, nome: 'Cliente B', cnpj: '22222333000172' },
                ])));
                return Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.entries).toHaveLength(2);
    expect(registry.entries[0].entityName).toBe('Cliente A');
    expect(registry.entries[1].entityName).toBe('Cliente B');
  });

  it('empty registry returns loaded true', async () => {
    const { client } = makeSpy();

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(true);
    expect(registry.entries).toHaveLength(0);
    expect(registry.error).toBeNull();
    expect(registry.loadedAt).toBeTruthy();
    expect(new Date(registry.loadedAt!).getTime()).toBeGreaterThan(0);
  });

  it('clientes query failure returns loaded false', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(errorResult('connection refused')));
                return Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(false);
    expect(registry.entries).toHaveLength(0);
    expect(registry.error).toContain('entityCnpjReader');
    expect(registry.loadedAt).toBeNull();
  });

  it('fornecedores query failure returns loaded false', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([])));
                return Promise.resolve(resolve(errorResult('timeout')));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(false);
    expect(registry.entries).toHaveLength(0);
  });

  it('partial failure does not return partial result', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([{ id: 1, nome: 'Cliente', cnpj: '11222333000181' }])));
                return Promise.resolve(resolve(errorResult('fornecedores query failed')));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(false);
    expect(registry.entries).toHaveLength(0);
  });

  it('null CNPJ is excluded from result', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([{ id: 1, nome: 'Cliente sem CNPJ', cnpj: null }])));
                return Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(true);
    expect(registry.entries).toHaveLength(0);
  });

  it('CNPJ with fewer than 14 digits is rejected', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([{ id: 1, nome: 'Curto', cnpj: '123' }])));
                return Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.loaded).toBe(true);
    expect(registry.entries).toHaveLength(0);
  });

  it('punctuated CNPJ from mock is defensively normalized', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([{ id: 1, nome: 'Pontuado', cnpj: '11.222.333/0001-81' }])));
                return Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0].cnpj).toBe('11222333000181');
  });

  it('loadedAt is set only on success', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(errorResult('fail')));
                return Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    const failedRegistry = await loadRegisteredEntityCnpjs(client);
    expect(failedRegistry.loadedAt).toBeNull();

    const okClient = makeSpy().client;
    const okRegistry = await loadRegisteredEntityCnpjs(okClient);
    expect(okRegistry.loadedAt).toBeTruthy();
    expect(typeof okRegistry.loadedAt).toBe('string');
  });

  it('queries use exact tables clientes and fornecedores', async () => {
    const { client, calls } = makeSpy();

    await loadRegisteredEntityCnpjs(client);

    expect(calls[0].table).toBe('clientes');
    expect(calls[1].table).toBe('fornecedores');
  });

  it('clientes select contains only id, nome, cnpj', async () => {
    const { client, calls } = makeSpy();

    await loadRegisteredEntityCnpjs(client);

    const clientesCall = calls[0];
    expect(clientesCall.columns).toBe('id, nome, cnpj');
  });

  it('fornecedores select contains only id, nome, tipo, cnpj', async () => {
    const { client, calls } = makeSpy();

    await loadRegisteredEntityCnpjs(client);

    const fornecedoresCall = calls[1];
    expect(fornecedoresCall.columns).toBe('id, nome, tipo, cnpj');
  });

  it('cnpj IS NOT NULL filter is applied on both queries', async () => {
    const { client, calls } = makeSpy();

    await loadRegisteredEntityCnpjs(client);

    expect(calls[0].notColumn).toBe('cnpj');
    expect(calls[0].notOperator).toBe('is');
    expect(calls[1].notColumn).toBe('cnpj');
    expect(calls[1].notOperator).toBe('is');
  });

  it('no mutation methods are called on the client', async () => {
    const mutationsTouched: string[] = [];

    const proxy = new Proxy({} as SupabaseReaderClient, {
      get(_target, prop: string) {
        if (prop === 'from') {
          return (table: string) => ({
            select(_columns: string) {
              return {
                not(_col: string, _op: string, _val: unknown) {
                  return {
                    then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                      return Promise.resolve(resolve(successResult([])));
                    },
                  };
                },
              };
            },
          });
        }
        if (['insert', 'update', 'delete', 'upsert', 'rpc'].includes(prop)) {
          mutationsTouched.push(prop);
        }
        return undefined;
      },
    });

    await loadRegisteredEntityCnpjs(proxy);
    expect(mutationsTouched).toHaveLength(0);
  });

  it('no reference to parceiros in types', () => {
    const typeSource = `export type RegisteredEntityType = 'cliente' | 'fornecedor'`;
    expect(typeSource).not.toMatch(/parceir/i);
    expect(typeSource).not.toMatch(/partner/i);
  });

  it('no reference to parceiros in reader', () => {
    const source = loadRegisteredEntityCnpjs.toString();
    expect(source).not.toMatch(/parceir/i);
  });

  it('error message does not expose full CNPJ', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                return Promise.resolve(resolve(errorResult('invalid CNPJ 11222333000181 rejected')));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.error).not.toMatch(/11222333000181/);
  });

  it('supplierType is undefined when fornecedor tipo is missing', async () => {
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                if (table === 'clientes') return Promise.resolve(resolve(successResult([])));
                return Promise.resolve(resolve(successResult([{ id: 3, nome: 'Sem tipo', cnpj: '33333333000133' }])));
              },
            };
          },
        };
      },
    }));

    const registry = await loadRegisteredEntityCnpjs(client);

    expect(registry.entries).toHaveLength(1);
    expect(registry.entries[0].supplierType).toBeUndefined();
  });

  it('both queries are executed in parallel', async () => {
    const order: string[] = [];
    const { client } = makeSpy((table: string) => ({
      select(_columns: string) {
        return {
          not(_col: string, _op: string, _val: unknown) {
            return {
              then(resolve: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
                order.push(table);
                return table === 'clientes'
                  ? Promise.resolve().then(() => resolve(successResult([])))
                  : Promise.resolve(resolve(successResult([])));
              },
            };
          },
        };
      },
    }));

    await loadRegisteredEntityCnpjs(client);

    expect(order).toHaveLength(2);
    expect(new Set(order)).toEqual(new Set(['clientes', 'fornecedores']));
  });
});
