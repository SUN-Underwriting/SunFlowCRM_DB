import prisma from '@/lib/db/prisma';
import { withRlsBypass } from '@/lib/db/rls-context';
import type { User, Tenant, UserRole } from '@prisma/client';

const DEFAULT_TENANT_SLUG = 'default';

export interface AppUser extends User {
  tenant: Tenant;
}

/**
 * Get or create a user in the application database.
 * Links SuperTokens user to our User model with tenant and role.
 *
 * @param supertokensUserId - The user ID from SuperTokens
 * @param email - User's email address
 * @returns The user with tenant information
 */
export async function getOrCreateUser(
  supertokensUserId: string,
  email: string
): Promise<AppUser> {
  return withRlsBypass(async () => {
    // Try to find existing user
    let user = await prisma.user.findUnique({
      where: { supertokensUserId },
      include: { tenant: true }
    });

    if (user) {
      return user;
    }

    // User doesn't exist - create with default tenant
    // First, ensure default tenant exists
    let tenant = await prisma.tenant.findUnique({
      where: { slug: DEFAULT_TENANT_SLUG }
    });

    if (!tenant) {
      tenant = await prisma.tenant.create({
        data: {
          name: 'Default Organization',
          slug: DEFAULT_TENANT_SLUG,
          plan: 'STARTER',
          status: 'ACTIVE'
        }
      });
    }

    // Check if this is the first user (will be ADMIN)
    const userCount = await prisma.user.count();
    const role: UserRole = userCount === 0 ? 'ADMIN' : 'MEMBER';

    // Create user
    user = await prisma.user.create({
      data: {
        supertokensUserId,
        email,
        tenantId: tenant.id,
        role,
        status: 'ACTIVE'
      },
      include: { tenant: true }
    });

    console.log(
      `[UserService] Created user ${email} with role ${role} in tenant ${tenant.slug}`
    );

    return user;
  });
}

/**
 * Get user by SuperTokens ID
 * Uses RLS bypass for cross-tenant user lookup by auth provider ID
 */
export async function getUserBySupertokensId(
  supertokensUserId: string
): Promise<AppUser | null> {
  return withRlsBypass(async () => {
    return prisma.user.findUnique({
      where: { supertokensUserId },
      include: { tenant: true }
    });
  });
}

/**
 * Update user's last online timestamp
 * Uses RLS bypass for cross-tenant user lookup by auth provider ID
 */
export async function updateUserLastOnline(
  supertokensUserId: string
): Promise<void> {
  await withRlsBypass(async () => {
    await prisma.user.update({
      where: { supertokensUserId },
      data: { lastOnline: new Date() }
    });
  });
}
