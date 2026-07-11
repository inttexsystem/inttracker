export type RegisteredEntityType = 'cliente' | 'fornecedor';

export interface RegisteredEntityCnpj {
  entityType: RegisteredEntityType;
  entityId: number;
  entityName: string;
  cnpj: string;
  supplierType?: string;
}

export interface EntityCnpjRegistry {
  loaded: boolean;
  loadedAt: string | null;
  entries: readonly RegisteredEntityCnpj[];
  error: string | null;
}
