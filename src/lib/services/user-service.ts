import { BaseService } from './base-service';
import { prisma } from '@/lib/db/prisma';
import { UserRole, UserStatus } from '@prisma/client';
import {
  ConflictError,
  NotFoundError,
  BusinessRuleError
} from '@/lib/errors/app-errors';
import { AuditService, AuditActions } from '@/lib/services/audit-service';
import { UserInviteService } from '@/lib/services/user-invite-service';
import { enqueueUserInviteEmailJob } from '@/server/notifications/queue';

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
  permissions?: Record<string, unknown>;
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
        permissions: true,
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
          status: UserStatus.INVITED
        }
      });
    });

    const { invite, token } = await UserInviteService.create({
      tenantId: this.tenantId,
      userId: newUser.id,
      email: newUser.email,
      createdById: this.userId
    });

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.FRONTEND_URL ??
      'http://localhost:3000';
    const inviteUrl = `${appUrl}/auth/accept-invite?token=${encodeURIComponent(token)}`;

    await enqueueUserInviteEmailJob({
      tenantId: this.tenantId,
      userId: newUser.id,
      to: newUser.email,
      subject: 'You are invited to SunFlow CRM',
      text: [
        'You have been invited to join SunFlow CRM.',
        `Role: ${newUser.role}`,
        '',
        `Accept invite: ${inviteUrl}`,
        '',
        `This invite expires on ${invite.expiresAt.toISOString()}.`
      ].join('\n'),
      html: [
        '<p>You have been invited to join <strong>SunFlow CRM</strong>.</p>',
        `<p><strong>Role:</strong> ${newUser.role}</p>`,
        `<p><a href="${inviteUrl}">Accept your invite</a></p>`,
        `<p>This invite expires on ${invite.expiresAt.toISOString()}.</p>`
      ].join(''),
      dedupeKey: `invite:${invite.id}`
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
    if (input.permissions !== undefined) {
      changes.permissionsUpdated = true;
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
