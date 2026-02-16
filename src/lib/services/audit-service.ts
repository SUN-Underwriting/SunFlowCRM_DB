import { prisma } from '@/lib/db/prisma';
import { withRlsBypass } from '@/lib/db/rls-context';

/**
 * Audit log action constants.
 * Convention: MODULE_ACTION (e.g. USER_INVITED, DEAL_CREATED)
 */
export const AuditActions = {
  // Auth
  AUTH_LOGIN: 'AUTH_LOGIN',
  AUTH_LOGOUT: 'AUTH_LOGOUT',
  AUTH_LOGIN_FAILED: 'AUTH_LOGIN_FAILED',

  // Users
  USER_INVITED: 'USER_INVITED',
  USER_UPDATED: 'USER_UPDATED',
  USER_ACTIVATED: 'USER_ACTIVATED',
  USER_DEACTIVATED: 'USER_DEACTIVATED',
  USER_ROLE_CHANGED: 'USER_ROLE_CHANGED',

  // Settings
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',

  // CRM - Deals
  DEAL_CREATED: 'DEAL_CREATED',
  DEAL_UPDATED: 'DEAL_UPDATED',
  DEAL_MOVED: 'DEAL_MOVED',
  DEAL_WON: 'DEAL_WON',
  DEAL_LOST: 'DEAL_LOST',
  DEAL_DELETED: 'DEAL_DELETED',

  // CRM - Leads
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_UPDATED: 'LEAD_UPDATED',
  LEAD_CONVERTED: 'LEAD_CONVERTED',
  LEAD_DELETED: 'LEAD_DELETED',

  // CRM - Contacts
  PERSON_CREATED: 'PERSON_CREATED',
  PERSON_UPDATED: 'PERSON_UPDATED',
  PERSON_DELETED: 'PERSON_DELETED',
  ORG_CREATED: 'ORG_CREATED',
  ORG_UPDATED: 'ORG_UPDATED',
  ORG_DELETED: 'ORG_DELETED',

  // CRM - Pipeline
  PIPELINE_CREATED: 'PIPELINE_CREATED',
  PIPELINE_UPDATED: 'PIPELINE_UPDATED',
  PIPELINE_DELETED: 'PIPELINE_DELETED',
  STAGE_CREATED: 'STAGE_CREATED',
  STAGE_UPDATED: 'STAGE_UPDATED',
  STAGE_DELETED: 'STAGE_DELETED'
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions];

export interface AuditLogInput {
  tenantId?: string;
  userId?: string;
  action: string;
  module: string;
  entityId?: string;
  entityType?: string;
  details?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  tenantId?: string;
  module?: string;
  action?: string;
  userId?: string;
  entityId?: string;
  entityType?: string;
  from?: Date;
  to?: Date;
  skip?: number;
  take?: number;
}

/**
 * AuditService — fire-and-forget audit logging.
 *
 * All writes bypass RLS because audit logs are a cross-cutting concern
 * and the AuditLog model is intentionally NOT in TENANT_MODELS.
 *
 * Usage:
 *   await AuditService.log({
 *       tenantId: user.tenantId,
 *       userId: user.id,
 *       action: AuditActions.USER_INVITED,
 *       module: 'USERS',
 *       entityId: newUser.id,
 *       entityType: 'User',
 *       details: { email: newUser.email, role: newUser.role },
 *   });
 */
export class AuditService {
  /**
   * Write an audit log entry.
   * Intentionally never throws — audit failures should not break business flows.
   */
  static async log(input: AuditLogInput): Promise<void> {
    try {
      await withRlsBypass(async () => {
        await prisma.auditLog.create({
          data: {
            tenantId: input.tenantId,
            userId: input.userId,
            action: input.action,
            module: input.module,
            entityId: input.entityId,
            entityType: input.entityType,
            details: input.details ?? {},
            ip: input.ip,
            userAgent: input.userAgent
          }
        });
      });
    } catch (error) {
      // Audit logging must never break the calling flow
      console.error('[AuditService] Failed to write audit log:', error, input);
    }
  }

  /**
   * Query audit logs with filters (read-only, for admin UI).
   * Must be called from within a valid request context or with RLS bypass.
   */
  static async query(filters: AuditLogFilters) {
    const {
      tenantId,
      module,
      action,
      userId,
      entityId,
      entityType,
      from,
      to,
      skip = 0,
      take = 50
    } = filters;

    const where = {
      ...(tenantId && { tenantId }),
      ...(module && { module }),
      ...(action && { action }),
      ...(userId && { userId }),
      ...(entityId && { entityId }),
      ...(entityType && { entityType }),
      ...((from || to) && {
        createdAt: {
          ...(from && { gte: from }),
          ...(to && { lte: to })
        }
      })
    };

    return withRlsBypass(async () => {
      const [logs, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: Math.min(take, 500)
        }),
        prisma.auditLog.count({ where })
      ]);

      return { logs, total };
    });
  }
}
