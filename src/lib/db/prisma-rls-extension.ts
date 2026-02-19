import { Prisma } from '@prisma/client';
import { getRequestContext } from '@/lib/db/rls-context';
import { TenantAccessError } from '@/lib/errors/app-errors';

/**
 * Models that have tenantId and should be automatically filtered by RLS
 * IMPORTANT: Only include models that actually exist in the Prisma schema
 */
const TENANT_MODELS = new Set([
  'User',
  'Organization',
  'Person',
  'Pipeline',
  'Stage',
  'Deal',
  'Lead',
  'LeadLabel',
  'LeadPermittedUser',
  'DealLabel',
  'DealPermittedUser',
  'Note',
  'Activity',
  'Email',
  'EmailAccount',
  'FieldDefinition'
  // Note: Tenant model itself is NOT included - tenant queries must be explicitly filtered
  // LeadLabelLink and DealLabelLink have no tenantId — access is controlled via Lead/Deal FK
]);

/**
 * Validate that relation IDs belong to the current tenant
 * This prevents cross-tenant data access via connect/disconnect/set operations
 *
 * Note: Uses Record<string, unknown> for data as Prisma extension args are generic
 * and we dynamically access model delegates at runtime
 */
async function validateRelationTenantAccess(
  prisma: Record<string, any>, // Prisma client with dynamic model access
  model: string,
  data: Record<string, unknown>,
  tenantId: string
): Promise<void> {
  if (!data || typeof data !== 'object') return;

  // Relation mapping: model -> relation field -> related model
  const relationChecks: Record<string, Record<string, string>> = {
    Deal: {
      pipeline: 'Pipeline',
      stage: 'Stage',
      person: 'Person',
      organization: 'Organization',
      creator: 'User'
    },
    Activity: {
      deal: 'Deal',
      person: 'Person',
      organization: 'Organization'
    },
    Email: {
      deal: 'Deal',
      person: 'Person',
      organization: 'Organization'
    },
    Lead: {
      person: 'Person',
      organization: 'Organization'
    },
    Person: {
      organization: 'Organization'
    },
    Organization: {
      owner: 'User'
    },
    Stage: {
      pipeline: 'Pipeline'
    }
  };

  const modelRelations = relationChecks[model];
  if (!modelRelations) return;

  // Check each field in data for relation operations
  for (const [field, relatedModel] of Object.entries(modelRelations)) {
    const relationOp = data[field] as Record<string, unknown> | undefined;
    if (!relationOp || typeof relationOp !== 'object') continue;

    // Extract IDs from connect/disconnect/set operations
    const idsToCheck: string[] = [];

    // Helper to extract ID from relation operation
    const extractIds = (op: unknown): string[] => {
      if (!op) return [];
      if (Array.isArray(op)) {
        return op
          .filter(
            (item): item is Record<string, unknown> =>
              typeof item === 'object' && item !== null
          )
          .map((item) => item.id)
          .filter((id): id is string => typeof id === 'string');
      }
      if (typeof op === 'object' && op !== null) {
        const obj = op as Record<string, unknown>;
        return obj.id && typeof obj.id === 'string' ? [obj.id] : [];
      }
      return [];
    };

    idsToCheck.push(...extractIds(relationOp.connect));
    idsToCheck.push(...extractIds(relationOp.set));
    idsToCheck.push(...extractIds(relationOp.disconnect));

    // Validate all IDs belong to the same tenant
    if (idsToCheck.length > 0) {
      const tableName = relatedModel.toLowerCase();
      const modelDelegate = prisma[tableName];

      if (!modelDelegate || typeof modelDelegate.findMany !== 'function') {
        console.error(`[RLS] Invalid model delegate for ${relatedModel}`);
        continue;
      }

      const records = (await modelDelegate.findMany({
        where: {
          id: { in: idsToCheck },
          tenantId
        },
        select: { id: true }
      })) as Array<{ id: string }>;

      if (records.length !== idsToCheck.length) {
        const foundIds = records.map((r) => r.id);
        const missingIds = idsToCheck.filter((id) => !foundIds.includes(id));
        throw new TenantAccessError(
          `[RLS] Relation validation failed: ${relatedModel} IDs [${missingIds.join(', ')}] not found or belong to different tenant`
        );
      }
    }
  }
}

/**
 * Prisma Client Extension for Row-Level Security (RLS)
 * Automatically filters all queries by tenantId to prevent cross-tenant data leakage
 *
 * This replaces the deprecated $use middleware API in Prisma v7
 */
export const createRlsExtension = () => {
  return Prisma.defineExtension((prisma) =>
    prisma.$extends({
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            const context = getRequestContext();

            // Skip RLS if no context or bypass flag is set
            if (!context || context.bypassRls) {
              return query(args);
            }

            // Skip RLS for models without tenantId
            if (!model || !TENANT_MODELS.has(model)) {
              return query(args);
            }

            const { tenantId } = context;

            // SECURITY: Validate tenantId exists
            if (!tenantId) {
              throw new TenantAccessError(
                '[RLS] Missing tenantId in request context'
              );
            }

            // Apply tenant isolation based on operation type
            switch (operation) {
              // Read operations - filter by tenantId
              case 'findUnique':
              case 'findUniqueOrThrow':
              case 'findFirst':
              case 'findFirstOrThrow':
              case 'findMany':
              case 'count':
              case 'aggregate':
              case 'groupBy': {
                args.where = {
                  ...args.where,
                  tenantId
                };
                break;
              }

              // Create operations - inject tenantId and validate relations
              case 'create': {
                if (typeof args.data === 'object' && args.data !== null) {
                  // Inject tenantId into data object
                  Object.assign(args.data, { tenantId });
                  // Validate relation operations (connect/set)
                  await validateRelationTenantAccess(
                    prisma as Record<string, any>,
                    model!,
                    args.data as Record<string, unknown>,
                    tenantId
                  );
                }
                break;
              }

              case 'createMany': {
                if (Array.isArray(args.data)) {
                  // Note: Using type assertion here due to Prisma's generic createMany input types
                  // which vary per model and are difficult to type precisely in $allOperations
                  args.data = args.data.map((item) => {
                    if (typeof item === 'object' && item !== null) {
                      return { ...item, tenantId };
                    }
                    return item;
                  }) as typeof args.data;
                }
                break;
              }

              // Update operations - filter by tenantId and prevent tenantId modification
              case 'update':
              case 'updateMany': {
                // SECURITY: Filter by tenantId
                args.where = {
                  ...args.where,
                  tenantId
                };

                // SECURITY: Prevent tenantId modification
                if (
                  args.data &&
                  typeof args.data === 'object' &&
                  'tenantId' in args.data
                ) {
                  const { tenantId: _, ...dataWithoutTenantId } = args.data;
                  args.data = dataWithoutTenantId;
                  console.warn(
                    '[RLS] Attempted tenantId modification blocked in update operation'
                  );
                }

                // Validate relation operations (connect/disconnect/set)
                if (args.data && typeof args.data === 'object') {
                  await validateRelationTenantAccess(
                    prisma as Record<string, any>,
                    model!,
                    args.data as Record<string, unknown>,
                    tenantId
                  );
                }
                break;
              }

              // Upsert - filter and inject tenantId + validate relations
              case 'upsert': {
                // Filter where clause by tenantId
                if (args.where && typeof args.where === 'object') {
                  Object.assign(args.where, { tenantId });
                }

                // Inject tenantId in create data and validate relations
                if (args.create && typeof args.create === 'object') {
                  Object.assign(args.create, { tenantId });
                  await validateRelationTenantAccess(
                    prisma as Record<string, any>,
                    model!,
                    args.create as Record<string, unknown>,
                    tenantId
                  );
                }

                // Filter update data by tenantId (prevent modification) and validate relations
                if (args.update && typeof args.update === 'object') {
                  if ('tenantId' in args.update) {
                    const update = args.update as Record<string, unknown>;
                    delete update.tenantId;
                    console.warn(
                      '[RLS] Attempted tenantId modification blocked in upsert operation'
                    );
                  }
                  await validateRelationTenantAccess(
                    prisma as Record<string, any>,
                    model!,
                    args.update as Record<string, unknown>,
                    tenantId
                  );
                }
                break;
              }

              // Delete operations - filter by tenantId
              case 'delete':
              case 'deleteMany': {
                args.where = {
                  ...args.where,
                  tenantId
                };
                break;
              }
            }

            return query(args);
          }
        }
      }
    })
  );
};
