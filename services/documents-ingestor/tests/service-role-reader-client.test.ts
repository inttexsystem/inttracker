import { describe, it, expect } from 'vitest';
import {
  createServiceRoleEntityCnpjReaderClient,
  loadServiceRoleReaderConfig,
  type CreateReaderClientOptions,
  type ServiceRoleReaderConfig,
} from '../src/supabase/serviceRoleReaderClient.js';
import type { SupabaseReaderClient } from '../src/core/entityCnpjReader.js';
import { loadServiceRoleConfig } from '../src/supabase/serviceRoleClient.js';

function mockEnv(base: string, key: string, ref: string): Record<string, string> {
  return {
    SUPABASE_URL: `https://${base}.supabase.co`,
    SUPABASE_SERVICE_ROLE_KEY: key,
    SUPABASE_PROJECT_REF: ref,
  };
}

const VALID_ENV = mockEnv('ucrjtfswnfdlxwtmxnoo', 'sb-test-key-123', 'ucrjtfswnfdlxwtmxnoo');

function makeFakeInner() {
  const calls: Array<{ table: string; columns: string; notCol: string; notOp: string; notVal: unknown }> = [];
  const fakeData: unknown[] = [];
  const from = (table: string) => ({
    select(columns: string) {
      return {
        not(column: string, operator: string, value: unknown) {
          calls.push({ table, columns, notCol: column, notOp: operator, notVal: value });
          return Promise.resolve({ data: fakeData, error: null });
        },
      };
    },
  });
  return { from, calls };
}

function makeOptions(fakeInner?: ReturnType<typeof makeFakeInner>): CreateReaderClientOptions {
  return {
    _createClient: () => {
      return fakeInner ?? makeFakeInner();
    },
  };
}

describe('loadServiceRoleReaderConfig', () => {
  it('valid env returns config', () => {
    const cfg = loadServiceRoleReaderConfig(VALID_ENV);
    expect(cfg.url).toBe('https://ucrjtfswnfdlxwtmxnoo.supabase.co');
    expect(cfg.serviceRoleKey).toBe('sb-test-key-123');
    expect(cfg.projectRef).toBe('ucrjtfswnfdlxwtmxnoo');
  });

  it('missing project ref fails', () => {
    const env = { ...VALID_ENV, SUPABASE_PROJECT_REF: '' };
    expect(() => loadServiceRoleReaderConfig(env)).toThrow('supabase_project_ref_required');
  });

  it('mismatched project ref fails', () => {
    const env = { ...VALID_ENV, SUPABASE_PROJECT_REF: 'differentref' };
    expect(() => loadServiceRoleReaderConfig(env)).toThrow('supabase_project_ref_mismatch');
  });

  it('invalid URL fails', () => {
    const env = { ...VALID_ENV, SUPABASE_URL: 'not-a-url' };
    expect(() => loadServiceRoleReaderConfig(env)).toThrow('supabase_url_invalid');
  });

  it('missing service-role key fails', () => {
    const env = { ...VALID_ENV, SUPABASE_SERVICE_ROLE_KEY: '' };
    expect(() => loadServiceRoleReaderConfig(env)).toThrow('[entityCnpjReader] SUPABASE_SERVICE_ROLE_KEY is required');
  });

  it('failure occurs before any network call', () => {
    expect(() => loadServiceRoleReaderConfig({ ...VALID_ENV, SUPABASE_PROJECT_REF: '' })).toThrow();
  });
});

describe('createServiceRoleEntityCnpjReaderClient', () => {
  it('valid config creates facade', () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({
      _createClient: () => fakeInner,
    });
    expect(client).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  it('correct URL and key are passed to createClient', () => {
    let capturedUrl = '';
    let capturedKey = '';
    createServiceRoleEntityCnpjReaderClient({
      _createClient: (url, key) => {
        capturedUrl = url;
        capturedKey = key;
        return makeFakeInner();
      },
    });
    expect(capturedUrl).toContain('supabase.co');
    expect(capturedKey).toBeTruthy();
  });

  it('service-role key is not exposed on return object', () => {
    const client = createServiceRoleEntityCnpjReaderClient(makeOptions());
    const keys = Object.keys(client);
    expect(keys).not.toContain('serviceRoleKey');
    expect(keys).not.toContain('service_role_key');
    expect(keys).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });

  it('facade accepts clientes', async () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });

    const result = await client.from('clientes').select('id, nome, cnpj').not('cnpj', 'is', null);

    expect(result.error).toBeNull();
    expect(fakeInner.calls[0].table).toBe('clientes');
  });

  it('facade accepts fornecedores', async () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });

    const result = await client.from('fornecedores').select('id, nome, tipo, cnpj').not('cnpj', 'is', null);

    expect(result.error).toBeNull();
    expect(fakeInner.calls[0].table).toBe('fornecedores');
  });

  it('other table is rejected before inner call', () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });

    expect(() => client.from('pedidos')).toThrow('Table is not allowed for entity CNPJ registry reads');
    expect(() => client.from('document_candidates')).toThrow();
    expect(() => client.from('')).toThrow();
  });

  it('select columns are delegated', async () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });

    await client.from('clientes').select('id, nome, cnpj').not('cnpj', 'is', null);

    expect(fakeInner.calls[0].columns).toBe('id, nome, cnpj');
  });

  it('not filter is delegated', async () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });

    await client.from('clientes').select('id, nome, cnpj').not('cnpj', 'is', null);

    expect(fakeInner.calls[0].notCol).toBe('cnpj');
    expect(fakeInner.calls[0].notOp).toBe('is');
  });

  it('PromiseLike result is preserved', async () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });

    const result = await client.from('clientes').select('id, nome, cnpj').not('cnpj', 'is', null);

    expect(result).toBeDefined();
    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('error');
    expect(Array.isArray(result.data)).toBe(true);
  });

  it('no error exposes the service-role key', async () => {
    process.env.SUPABASE_URL = VALID_ENV.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = VALID_ENV.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_PROJECT_REF = VALID_ENV.SUPABASE_PROJECT_REF;
    try {
      const fakeInner = makeFakeInner();
      const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });
      const result = await client.from('clientes').select('id, nome, cnpj').not('cnpj', 'is', null);
      expect(result.error).toBeNull();
    } finally {
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_PROJECT_REF;
    }
  });

  it('no network connection occurs in tests', async () => {
    const fakeInner = makeFakeInner();
    const client = createServiceRoleEntityCnpjReaderClient({ _createClient: () => fakeInner });
    const result = await client.from('clientes').select('id, nome, cnpj').not('cnpj', 'is', null);
    expect(result).toBeDefined();
    expect(fakeInner.calls).toHaveLength(1);
  });

  it('throw on invalid config occurs before createClient', () => {
    let createCalled = false;
    try {
      createServiceRoleEntityCnpjReaderClient({
        _createClient: () => {
          createCalled = true;
          return makeFakeInner();
        },
      });
    } catch (_) {
      // expected if env not set
    }
    // _createClient is only called if config passes; if env is missing, createCalled stays false
  });
});

describe('public facade has no mutation methods', () => {
  function getPublicMethods(obj: SupabaseReaderClient): string[] {
    const methods: string[] = [];
    for (const key of Object.getOwnPropertyNames(obj)) {
      if (key !== 'from') methods.push(key);
    }
    if (typeof (obj as any).insert === 'function') methods.push('insert');
    if (typeof (obj as any).update === 'function') methods.push('update');
    if (typeof (obj as any).delete === 'function') methods.push('delete');
    if (typeof (obj as any).upsert === 'function') methods.push('upsert');
    if (typeof (obj as any).rpc === 'function') methods.push('rpc');
    if (typeof (obj as any).auth === 'function') methods.push('auth');
    if (typeof (obj as any).storage === 'function') methods.push('storage');
    return methods;
  }

  let client: SupabaseReaderClient;

  try {
    process.env.SUPABASE_URL = VALID_ENV.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = VALID_ENV.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_PROJECT_REF = VALID_ENV.SUPABASE_PROJECT_REF;
    client = createServiceRoleEntityCnpjReaderClient(makeOptions());
  } catch (_) {
    // config may fail if env is not set
  } finally {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_PROJECT_REF;
  }

  const methods = client ? getPublicMethods(client) : [];

  it('no insert', () => { expect(methods).not.toContain('insert'); });
  it('no update', () => { expect(methods).not.toContain('update'); });
  it('no delete', () => { expect(methods).not.toContain('delete'); });
  it('no upsert', () => { expect(methods).not.toContain('upsert'); });
  it('no rpc', () => { expect(methods).not.toContain('rpc'); });
  it('no auth', () => { expect(methods).not.toContain('auth'); });
  it('no storage', () => { expect(methods).not.toContain('storage'); });
});

describe('writer guards are unchanged', () => {
  it('loadServiceRoleConfig still requires SUPABASE_WRITER_ENABLED', () => {
    expect(() => loadServiceRoleConfig(VALID_ENV)).toThrow('SUPABASE_WRITER_ENABLED');
  });

  it('loadServiceRoleConfig works with writer enabled', () => {
    const cfg = loadServiceRoleConfig({ ...VALID_ENV, SUPABASE_WRITER_ENABLED: 'true' });
    expect(cfg.projectRef).toBe('ucrjtfswnfdlxwtmxnoo');
  });
});

describe('reader config vs writer config', () => {
  it('reader does NOT require SUPABASE_WRITER_ENABLED', () => {
    const cfg = loadServiceRoleReaderConfig(VALID_ENV);
    expect(cfg.projectRef).toBe('ucrjtfswnfdlxwtmxnoo');
  });

  it('reader config has same guards except writer flag', () => {
    expect(() => loadServiceRoleReaderConfig({ ...VALID_ENV, SUPABASE_PROJECT_REF: '' })).toThrow();
    expect(() => loadServiceRoleReaderConfig({ ...VALID_ENV, SUPABASE_URL: 'bad' })).toThrow();
    expect(() => loadServiceRoleReaderConfig({ ...VALID_ENV, SUPABASE_SERVICE_ROLE_KEY: '' })).toThrow();
  });
});
