import { BaseService } from './base-service';
import { prisma } from '@/lib/db/prisma';
import { UserRole, UserStatus } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
  BusinessRuleError
} from '@/lib/errors/app-errors';
import { AuditService, AuditActions } from '@/lib/services/audit-service';
import { v4 as uuidv4 } from 'uuid';

export interface CreateUserInput {
  email: string;
  firstName?: string;
  lastName?: string;
  role: UserRole;
}

export interface UpdateUserInput {
  firstName?: string;
  lastName?: string;
  role?: UserRole;
  status?: UserStatus;
  avatar?: string;
}

/**
 * UserService - Manages user operations within tenant context
 * Best Practice: Encapsulates business logic and validation
 */
export class UserService extends BaseService {
  /**
   * List all users in the current tenant
   */
  async list() {
    const users = await prisma.user.findMany({
      where: this.getTenantFilter(),
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        lastOnline: true,
        avatar: true
      }
    });

    return users;
  }

  /**
   * Get user by ID
   */
  async getById(id: string) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        ...this.getTenantFilter()
      }
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * Invite/provision a new user to the tenant.
   *
   * For Stack Auth: creates user in Stack Auth + our DB via UserProvisioningService.
   * For SuperTokens: creates a placeholder (invite flow, reconciled at sign-up).
   */
  async inviteUser(input: CreateUserInput) {
    const { getAuthProviderType } = await import(
      '@/lib/auth/providers/factory'
    );
    const provider = getAuthProviderType();

    if (provider === 'stack') {
      // Full provisioning: Stack Auth + Prisma
      const { UserProvisioningService } = await import(
        '@/lib/services/user-provisioning-service'
      );

      const result = await UserProvisioningService.provisionUser(
        {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          role: input.role,
          tenantId: this.tenantId
        },
        this.userId
      );

      // Return compatible shape
      return await prisma.user.findUnique({ where: { id: result.user.id } });
    }

    // SuperTokens: placeholder invite flow
    const placeholderId = `invite:${uuidv4()}`;

    const newUser = await prisma.$transaction(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: input.email, tenantId: this.tenantId }
      });

      if (existingUser) {
        throw new ConflictError('User already exists in this organization');
      }

      return await tx.user.create({
        data: {
          email: input.email,
          role: input.role,
          firstName: input.firstName,
          lastName: input.lastName,
          tenantId: this.tenantId,
          status: UserStatus.INVITED,
          supertokensUserId: placeholderId
        }
      });
    });

    // Audit: user invited
    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.USER_INVITED,
      module: 'USERS',
      entityId: newUser.id,
      entityType: 'User',
      details: { email: newUser.email, role: newUser.role }
    });

    return newUser;
  }

  /**
   * Update user profile/role
   */
  async update(id: string, input: UpdateUserInput) {
    const existingUser = await prisma.user.findFirst({
      where: {
        id,
        ...this.getTenantFilter()
      }
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: input
    });

    // Audit: user updated (including role changes)
    const changes: Record<string, unknown> = {};
    if (input.role && input.role !== existingUser.role) {
      changes.roleFrom = existingUser.role;
      changes.roleTo = input.role;
    }
    if (input.status && input.status !== existingUser.status) {
      changes.statusFrom = existingUser.status;
      changes.statusTo = input.status;
    }
    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action:
        input.role && input.role !== existingUser.role
          ? AuditActions.USER_ROLE_CHANGED
          : AuditActions.USER_UPDATED,
      module: 'USERS',
      entityId: id,
      entityType: 'User',
      details: changes
    });

    return updatedUser;
  }

  /**
   * Deactivate user (soft delete)
   * Context7: Wrap admin count check and update in transaction to prevent race conditions
   */
  async deactivate(id: string) {
    const deactivated = await prisma.$transaction(async (tx) => {
      // Check if this is an active admin
      const user = await tx.user.findFirst({
        where: { id, ...this.getTenantFilter() }
      });

      if (!user) {
        throw new NotFoundError('User not found');
      }

      // If deactivating an admin, ensure at least one other active admin exists
      if (user.role === UserRole.ADMIN && user.status === UserStatus.ACTIVE) {
        const activeAdminCount = await tx.user.count({
          where: {
            tenantId: this.tenantId,
            role: UserRole.ADMIN,
            status: UserStatus.ACTIVE
          }
        });

        if (activeAdminCount <= 1) {
          throw new BusinessRuleError(
            'Cannot deactivate the last active admin'
          );
        }
      }

      return await tx.user.update({
        where: { id },
        data: { status: UserStatus.INACTIVE }
      });
    });

    // Audit: user deactivated (outside tx to avoid blocking)
    await AuditService.log({
      tenantId: this.tenantId,
      userId: this.userId,
      action: AuditActions.USER_DEACTIVATED,
      module: 'USERS',
      entityId: id,
      entityType: 'User'
    });

    return deactivated;
  }

  /**
   * Activate user
   */
  async activate(id: string) {
    return this.update(id, { status: UserStatus.ACTIVE });
  }

  /**
   * Check if user has permission to manage users
   * Best Practice: Centralize permission checks
   */
  async canManageUsers(userId: string): Promise<boolean> {
    const user = await this.getById(userId);
    return user.role === UserRole.ADMIN;
  }
}
