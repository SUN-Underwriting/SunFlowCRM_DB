import { prisma } from '@/lib/db/prisma';
import { NextRequest, NextResponse } from 'next/server';
import {
  withSessionContext,
  getSessionPayload,
  type SessionPayload
} from '@/lib/auth/get-session';
import { NotFoundError, ForbiddenError } from '@/lib/errors/app-errors';
import { getAuthProviderType } from '@/lib/auth/providers/factory';

/** Return shape for getCurrentUser — user info with tenant details */
export interface CurrentUser {
  id: string;
  tenantId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

/**
 * Resolve full user record from session payload.
 * Must be called inside an active RLS context (e.g. within withSessionContext).
 *
 * Automatically detects the auth provider and queries by the correct user ID field.
 */
async function resolveUser(session: SessionPayload): Promise<CurrentUser> {
  const authProvider = getAuthProviderType();

  // Query by the correct field based on auth provider
  const user = await prisma.user.findUnique({
    where:
      authProvider === 'stack'
        ? { stackAuthUserId: session.userId }
        : { supertokensUserId: session.userId },
    include: { tenant: true }
  });

  if (!user) {
    throw new NotFoundError('User not found in database');
  }

  if (user.status !== 'ACTIVE') {
    throw new ForbiddenError('User account is not active');
  }

  if (user.tenant.status !== 'ACTIVE') {
    throw new ForbiddenError('Tenant account is not active');
  }

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    tenant: {
      id: user.tenant.id,
      name: user.tenant.name,
      slug: user.tenant.slug,
      plan: user.tenant.plan
    }
  };
}

/**
 * Run an API route handler with full user context.
 *
 * - Validates session (throws 401 if missing)
 * - Sets up async-isolated RLS context via AsyncLocalStorage.run()
 * - Resolves full DB user (throws 404 / 403 if invalid)
 * - Passes CurrentUser to the handler callback
 * - Returns NextResponse with proper session cookies
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   try {
 *     return await withCurrentUser(request, async (user) => {
 *       const service = new DealService(user.tenantId, user.id);
 *       return apiResponse(await service.list());
 *     });
 *   } catch (error) {
 *     return handleApiError(error);
 *   }
 * }
 */
export async function withCurrentUser(
  request: NextRequest,
  handler: (user: CurrentUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return withSessionContext(request, async (session) => {
    const user = await resolveUser(session);
    return handler(user);
  });
}

/**
 * Run an API route handler requiring specific roles.
 *
 * @example
 * export async function DELETE(request: NextRequest) {
 *   try {
 *     return await withRole(request, ['ADMIN'], async (user) => {
 *       await userService.deactivate(userId);
 *       return apiResponse({ success: true });
 *     });
 *   } catch (error) {
 *     return handleApiError(error);
 *   }
 * }
 */
export async function withRole(
  request: NextRequest,
  requiredRoles: string[],
  handler: (user: CurrentUser) => Promise<NextResponse>
): Promise<NextResponse> {
  return withCurrentUser(request, async (user) => {
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenError(
        `Required role is one of [${requiredRoles.join(', ')}]`
      );
    }
    return handler(user);
  });
}

/**
 * Get current user or return null if not authenticated.
 * Does NOT set up RLS context — use this only for read-only checks.
 */
export async function getCurrentUserOrNull(
  request: NextRequest
): Promise<CurrentUser | null> {
  try {
    const session = await getSessionPayload(request);
    if (!session) return null;

    const authProvider = getAuthProviderType();

    // Resolve user without RLS context (just a direct query)
    // Query by the correct field based on auth provider
    const user = await prisma.user.findUnique({
      where:
        authProvider === 'stack'
          ? { stackAuthUserId: session.userId }
          : { supertokensUserId: session.userId },
      include: { tenant: true }
    });

    if (!user || user.status !== 'ACTIVE' || user.tenant.status !== 'ACTIVE') {
      return null;
    }

    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenant: {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
        plan: user.tenant.plan
      }
    };
  } catch {
    return null;
  }
}
