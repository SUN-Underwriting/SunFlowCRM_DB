/**
 * UserProvisioningService
 *
 * Central service for creating and syncing users between
 * the auth provider (Stack Auth / SuperTokens) and our Prisma database.
 *
 * Three entry points:
 *   1. Admin provisioning — admin creates user via API
 *   2. Webhook sync — auth provider fires user.created event
 *   3. Session-time auto-provisioning — fallback for dev/first-login
 *
 * Stack Auth docs reference:
 *   - POST /users: creates user with email, password, serverMetadata
 *   - Webhooks: user.created, user.updated, user.deleted
 *   - serverMetadata: stores tenantId and roles (server-only, not exposed to client)
 */

import { prisma } from '@/lib/db/prisma';
import { withRlsBypass } from '@/lib/db/rls-context';
import { UserRole, UserStatus } from '@prisma/client';
import { ConflictError, NotFoundError } from '@/lib/errors/app-errors';
import { AuditService, AuditActions } from '@/lib/services/audit-service';
import { getAuthProviderType } from '@/lib/auth/providers/factory';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ProvisionUserInput {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  role?: UserRole;
}

export interface ProvisionUserToTenantInput extends ProvisionUserInput {
  tenantId: string;
}

export interface ProvisionResult {
  user: {
    id: string;
    email: string;
    tenantId: string;
    role: string;
    status: string;
  };
  authUserId: string;
  isNew: boolean;
}

export interface SyncFromAuthInput {
  authUserId: string;
  email: string;
  displayName?: string;
}

// ──────────────────────────────────────────────
// Service
// ──────────────────────────────────────────────

export class UserProvisioningService {
  /**
   * Admin-provisioned user creation.
   * Creates user in auth provider first, then in our DB.
   * If auth provider creation fails, no DB record is created.
   * If DB creation fails, we attempt to clean up the auth provider user.
   *
   * @param input - User details + target tenant
   * @param adminUserId - ID of the admin performing the action (for audit)
   */
  static async provisionUser(
    input: ProvisionUserToTenantInput,
    adminUserId?: string
  ): Promise<ProvisionResult> {
    const provider = getAuthProviderType();

    // 1. Verify tenant exists
    const tenant = await withRlsBypass(() =>
      prisma.tenant.findUnique({ where: { id: input.tenantId } })
    );
    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // 2. Check if user already exists in this tenant
    const existingUser = await withRlsBypass(() =>
      prisma.user.findFirst({
        where: { email: input.email, tenantId: input.tenantId }
      })
    );
    if (existingUser) {
      throw new ConflictError('User already exists in this organization');
    }

    // 3. Create user in auth provider
    let authUserId: string;

    if (provider === 'stack') {
      authUserId = await this.createStackAuthUser(input);
    } else {
      authUserId = await this.createSuperTokensUser(input);
    }

    // 4. Create user in our DB
    let dbUser;
    try {
      dbUser = await withRlsBypass(() =>
        prisma.user.create({
          data: {
            email: input.email,
            firstName:
              input.firstName || input.displayName?.split(' ')[0] || null,
            lastName:
              input.lastName ||
              input.displayName?.split(' ').slice(1).join(' ') ||
              null,
            role: input.role || UserRole.MEMBER,
            status: UserStatus.ACTIVE,
            tenantId: input.tenantId,
            ...(provider === 'stack'
              ? { stackAuthUserId: authUserId }
              : { supertokensUserId: authUserId })
          }
        })
      );
    } catch (dbError) {
      // Rollback: try to delete user from auth provider
      console.error(
        '[Provisioning] DB creation failed, rolling back auth user:',
        dbError
      );
      try {
        if (provider === 'stack') {
          await this.deleteStackAuthUser(authUserId);
        }
      } catch (rollbackError) {
        console.error('[Provisioning] Rollback failed:', rollbackError);
      }
      throw dbError;
    }

    // 5. Sync metadata back to auth provider
    if (provider === 'stack') {
      await this.syncStackAuthMetadata(authUserId, {
        tenantId: input.tenantId,
        roles: [input.role || 'MEMBER']
      }).catch((e) => {
        console.warn('[Provisioning] Failed to sync serverMetadata:', e);
      });
    }

    // 6. Audit log
    if (adminUserId) {
      await AuditService.log({
        tenantId: input.tenantId,
        userId: adminUserId,
        action: AuditActions.USER_INVITED,
        module: 'USERS',
        entityId: dbUser.id,
        entityType: 'User',
        details: {
          email: input.email,
          role: input.role || 'MEMBER',
          provider
        }
      });
    }

    return {
      user: {
        id: dbUser.id,
        email: dbUser.email,
        tenantId: dbUser.tenantId,
        role: dbUser.role,
        status: dbUser.status
      },
      authUserId,
      isNew: true
    };
  }

  /**
   * Sync a user from auth provider into our DB.
   * Used by webhooks and session-time auto-provisioning.
   *
   * If the user already exists (by authUserId or email), links them.
   * If not, creates a new tenant + user (auto-provisioning for dev).
   */
  static async syncFromAuthProvider(
    input: SyncFromAuthInput
  ): Promise<ProvisionResult> {
    const provider = getAuthProviderType();
    const authIdField =
      provider === 'stack' ? 'stackAuthUserId' : 'supertokensUserId';

    // 1. Check if user already exists by auth ID
    let dbUser = await withRlsBypass(() =>
      prisma.user.findFirst({
        where: { [authIdField]: input.authUserId }
      })
    );

    if (dbUser) {
      return {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          tenantId: dbUser.tenantId,
          role: dbUser.role,
          status: dbUser.status
        },
        authUserId: input.authUserId,
        isNew: false
      };
    }

    // 2. Check if user exists by email (invited user or cross-provider)
    dbUser = await withRlsBypass(() =>
      prisma.user.findFirst({
        where: { email: input.email },
        orderBy: { createdAt: 'desc' }
      })
    );

    if (dbUser) {
      // Link existing user to auth provider
      await withRlsBypass(() =>
        prisma.user.update({
          where: { id: dbUser!.id },
          data: {
            [authIdField]: input.authUserId,
            status:
              dbUser!.status === UserStatus.INVITED
                ? UserStatus.ACTIVE
                : dbUser!.status
          }
        })
      );

      return {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          tenantId: dbUser.tenantId,
          role: dbUser.role,
          status: UserStatus.ACTIVE
        },
        authUserId: input.authUserId,
        isNew: false
      };
    }

    // 3. Auto-provision: create new tenant + user
    const slug = input.email
      .split('@')[0]
      .replace(/[^a-z0-9]/gi, '-')
      .toLowerCase();

    const result = await withRlsBypass(() =>
      prisma.$transaction(async (tx) => {
        const newTenant = await tx.tenant.create({
          data: {
            name: `${slug}'s Organization`,
            slug: `${slug}-${Date.now().toString(36)}`,
            plan: 'STARTER',
            status: 'ACTIVE'
          }
        });

        const newUser = await tx.user.create({
          data: {
            email: input.email,
            firstName: input.displayName?.split(' ')[0] || null,
            lastName: input.displayName?.split(' ').slice(1).join(' ') || null,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE,
            tenantId: newTenant.id,
            [authIdField]: input.authUserId
          }
        });

        return { tenant: newTenant, user: newUser };
      })
    );

    console.info(
      '[Provisioning] Auto-provisioned:',
      `tenant=${result.tenant.id}`,
      `user=${result.user.id}`,
      `email=${input.email}`
    );

    return {
      user: {
        id: result.user.id,
        email: result.user.email,
        tenantId: result.user.tenantId,
        role: result.user.role,
        status: result.user.status
      },
      authUserId: input.authUserId,
      isNew: true
    };
  }

  // ──────────────────────────────────────────────
  // Stack Auth helpers
  // ──────────────────────────────────────────────

  /**
   * Create user in Stack Auth via server SDK.
   * Stack Auth docs: POST /users — creates user with email + password.
   */
  private static async createStackAuthUser(
    input: ProvisionUserInput
  ): Promise<string> {
    const { getStackServerApp } = await import('@/stack/server');
    const app = getStackServerApp();

    const user = await app.createUser({
      primaryEmail: input.email,
      primaryEmailVerified: true,
      password: input.password || undefined,
      displayName:
        input.displayName ||
        [input.firstName, input.lastName].filter(Boolean).join(' ') ||
        undefined
    });

    return user.id;
  }

  /**
   * Delete user from Stack Auth (rollback helper).
   */
  private static async deleteStackAuthUser(userId: string): Promise<void> {
    const { getStackServerApp } = await import('@/stack/server');
    const app = getStackServerApp();
    const user = await app.getUser(userId);
    if (user) {
      await user.delete();
    }
  }

  /**
   * Sync serverMetadata to Stack Auth.
   * Stores tenantId and roles for server-side session resolution.
   */
  private static async syncStackAuthMetadata(
    userId: string,
    metadata: { tenantId: string; roles: string[] }
  ): Promise<void> {
    const { getStackServerApp } = await import('@/stack/server');
    const app = getStackServerApp();
    const user = await app.getUser(userId);
    if (user) {
      await user.update({
        serverMetadata: metadata
      });
    }
  }

  /**
   * Create user in SuperTokens.
   * Placeholder — uses the existing invite flow with placeholder ID.
   */
  private static async createSuperTokensUser(
    input: ProvisionUserInput
  ): Promise<string> {
    // SuperTokens user creation happens at sign-up time.
    // For admin provisioning, we create a placeholder ID
    // that gets reconciled when the user actually signs up.
    const { v4: uuidv4 } = await import('uuid');
    return `invite:${uuidv4()}`;
  }
}
