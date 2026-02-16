import prisma from '@/lib/db/prisma';
import { withRlsBypass } from '@/lib/db/rls-context';
import type { AppUser } from '@/lib/auth/user-service';
import { getAuthProviderType } from '@/lib/auth/providers/factory';

/**
 * Reconcile invited user with auth provider user ID.
 * Works with both SuperTokens and Stack Auth.
 *
 * @param authUserId - User ID from the auth provider (SuperTokens or Stack Auth)
 * @param email - User's email address
 * @returns Updated user or null if no invitation found
 */
export async function reconcileInvitedUser(
  authUserId: string,
  email: string
): Promise<AppUser | null> {
  const authProvider = getAuthProviderType();

  return withRlsBypass(async () => {
    const invitedUser = await prisma.user.findFirst({
      where: {
        email,
        status: 'INVITED'
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: { tenant: true }
    });

    if (!invitedUser) {
      return null;
    }

    // Check if user already has the auth ID (already reconciled)
    const existingAuthId =
      authProvider === 'stack'
        ? invitedUser.stackAuthUserId
        : invitedUser.supertokensUserId;

    if (existingAuthId === authUserId) {
      return invitedUser;
    }

    // Update with the correct auth provider ID
    const updatedUser = await prisma.user.update({
      where: { id: invitedUser.id },
      data: {
        ...(authProvider === 'stack'
          ? { stackAuthUserId: authUserId }
          : { supertokensUserId: authUserId }),
        status: 'ACTIVE'
      },
      include: { tenant: true }
    });

    return updatedUser;
  });
}

/**
 * Check if a user was invited.
 * Works with both SuperTokens and Stack Auth.
 */
export async function wasUserInvited(
  email: string,
  tenantId?: string
): Promise<boolean> {
  const authProvider = getAuthProviderType();

  return withRlsBypass(async () => {
    const where: any = {
      email,
      status: 'INVITED'
    };

    // Check for placeholder ID based on provider
    if (authProvider === 'supertokens') {
      where.supertokensUserId = { startsWith: 'invite:' };
    } else {
      where.stackAuthUserId = { startsWith: 'invite:' };
    }

    if (tenantId) {
      where.tenantId = tenantId;
    }

    const count = await prisma.user.count({ where });
    return count > 0;
  });
}
