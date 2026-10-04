import type { TenantContext } from '../middleware/tenant';

/**
 * Returns helpers that inject tenant filters into Mongoose query objects.
 * Every database read/write in a tenant-scoped route must go through one of these.
 */
export function createTenantScope(tenant: TenantContext) {
  return {
    /** Inject shopId + organizationId — use for shop-level documents */
    scope<T extends Record<string, unknown>>(query: T = {} as T) {
      return {
        ...query,
        shopId: tenant.shopId,
        organizationId: tenant.organizationId,
      };
    },

    /** Inject organizationId only — use for org-level documents (e.g. backups, subscriptions) */
    scopeOrg<T extends Record<string, unknown>>(query: T = {} as T) {
      return {
        ...query,
        organizationId: tenant.organizationId,
      };
    },
  };
}
