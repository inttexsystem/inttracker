import { createClient } from '@supabase/supabase-js';
import type { SupabaseReaderClient } from '../core/entityCnpjReader.js';
import { config } from '../config.js';
import { extractProjectRefFromUrl } from './serviceRoleClient.js';

export interface ServiceRoleReaderConfig {
  url: string;
  serviceRoleKey: string;
  projectRef: string;
}

export interface CreateReaderClientOptions {
  _createClient?: (url: string, serviceRoleKey: string) => {
    from(table: string): {
      select(columns: string): {
        not(column: string, operator: string, value: unknown): any;
      };
    };
  };
}

function requiredEnv(env: NodeJS.ProcessEnv, name: string, configuredValue: string): string {
  const value = env[name]?.trim() || configuredValue.trim();
  if (!value) {
    throw new Error(`[entityCnpjReader] ${name} is required.`);
  }
  return value;
}

export function loadServiceRoleReaderConfig(
  env: NodeJS.ProcessEnv = process.env,
): ServiceRoleReaderConfig {
  const useLoadedDotEnv = env === process.env;

  const url = requiredEnv(env, 'SUPABASE_URL', useLoadedDotEnv ? config.supabaseUrl : '');
  const serviceRoleKey = requiredEnv(env, 'SUPABASE_SERVICE_ROLE_KEY', useLoadedDotEnv ? config.supabaseServiceRoleKey : '');

  const urlProjectRef = extractProjectRefFromUrl(url);

  const projectRef = env.SUPABASE_PROJECT_REF?.trim() || (useLoadedDotEnv ? config.supabaseProjectRef.trim() : '') || '';
  if (!projectRef) {
    throw new Error('supabase_project_ref_required');
  }

  if (urlProjectRef !== projectRef) {
    throw new Error('supabase_project_ref_mismatch');
  }

  return { url, serviceRoleKey, projectRef };
}

const ALLOWED_TABLES = new Set(['clientes', 'fornecedores']);

export function createServiceRoleEntityCnpjReaderClient(
  options: CreateReaderClientOptions = {},
): SupabaseReaderClient {
  const buildClient = options._createClient ?? createClient;
  const cfg = loadServiceRoleReaderConfig(process.env);
  const inner = buildClient(cfg.url, cfg.serviceRoleKey);

  return {
    from(table: string) {
      if (!ALLOWED_TABLES.has(table)) {
        throw new Error('Table is not allowed for entity CNPJ registry reads');
      }
      const builder = inner.from(table);
      return {
        select(columns: string) {
          const filtered = builder.select(columns);
          return {
            not(column: string, operator: string, value: unknown): PromiseLike<{
              data: unknown[] | null;
              error: { message: string } | null;
            }> {
              return filtered.not(column, operator, value) as PromiseLike<{
                data: unknown[] | null;
                error: { message: string } | null;
              }>;
            },
          };
        },
      };
    },
  };
}
