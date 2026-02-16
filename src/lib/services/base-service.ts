import { prisma } from '@/lib/db/prisma';
import { NotFoundError, TenantAccessError } from '@/lib/errors/app-errors';

/**
 * Base service class for all CRM services
 * Provides tenant isolation and common utilities
 */
export abstract class BaseService {
  constructor(
    protected readonly tenantId: string,
    protected readonly userId: string
  ) {}

  /**
   * Ensure a record belongs to the current tenant
   * @throws NotFoundError if record doesn't exist
   * @throws TenantAccessError if record belongs to different tenant
   */
  protected ensureTenantAccess(record: { tenantId: string } | null): void {
    if (!record) {
      throw new NotFoundError('Record not found');
    }

    if (record.tenantId !== this.tenantId) {
      throw new TenantAccessError(
        'Access denied: resource belongs to different tenant'
      );
    }
  }

  /**
   * Get base filter for tenant-scoped queries
   */
  protected getTenantFilter() {
    return { tenantId: this.tenantId };
  }

  /**
   * Get base filter including soft delete
   */
  protected getActiveFilter() {
    return {
      tenantId: this.tenantId,
      deleted: false
    };
  }
}

/**
 * Helper to create service instance with current user context
 */
export function createService<T extends BaseService>(
  ServiceClass: new (tenantId: string, userId: string) => T,
  tenantId: string,
  userId: string
): T {
  return new ServiceClass(tenantId, userId);
}
