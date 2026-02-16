import { NextRequest, NextResponse } from 'next/server';
import { runInRequestContext } from '@/lib/db/rls-context';
import {
  UnauthorizedError,
  TenantContextMissingError,
  ForbiddenError
} from '@/lib/errors/app-errors';
import { getAuthAdapter } from '@/lib/auth/providers/factory';

/**
 * Re-export SessionPayload from types for backward compatibility.
 * Avoid importing from this file - prefer importing from @/lib/auth/providers/types
 */
export type { SessionPayload } from '@/lib/auth/providers/types';

/**
 * Get session payload without setting up RLS context.
 * Useful for read-only operations that don't need DB access.
 */
export async function getSessionPayload(
  request: NextRequest
): Promise<SessionPayload | null> {
  const authAdapter = await getAuthAdapter();
  return authAdapter.getSession(request);
}

/**
 * Run a handler within a properly isolated async RLS context.
 * Works with any auth provider via the adapter pattern.
 *
 * This uses AsyncLocalStorage.run() (NOT enterWith()) to ensure
 * the tenant context is correctly scoped to this request only,
 * preventing cross-request context leakage under concurrent load.
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   return withSessionContext(request, async (session) => {
 *     // All DB operations here are automatically scoped to session.tenantId
 *     const data = await prisma.deal.findMany({});
 *     return apiResponse(data);
 *   });
 * }
 */
export async function withSessionContext(
  request: NextRequest,
  handler: (session: SessionPayload) => Promise<NextResponse>
): Promise<NextResponse> {
  const authAdapter = await getAuthAdapter();
  const session = await authAdapter.getSession(request);

  // No session exists
  if (!session) {
    throw new UnauthorizedError('No valid session');
  }

  // Validate tenant context
  if (!session.tenantId) {
    console.error('[Auth] SECURITY: Session missing tenantId:', {
      userId: session.userId,
      email: session.email
    });
    throw new TenantContextMissingError(
      'Invalid session: missing tenant context'
    );
  }

  // Run handler within RLS context
  return runInRequestContext(
    {
      tenantId: session.tenantId,
      userId: session.userId
    },
    () => handler(session)
  );
}

/**
 * Require a specific role. Throws if user doesn't have the role.
 *
 * @example
 * export async function DELETE(request: NextRequest) {
 *   return withSessionContext(request, async (session) => {
 *     requireRoleFromSession(session, 'ADMIN');
 *     // ... handle admin-only request
 *   });
 * }
 */
export function requireRoleFromSession(
  session: SessionPayload,
  role: string
): void {
  if (!session.roles.includes(role)) {
    throw new ForbiddenError(`Requires ${role} role`);
  }
}

/**
 * Require any of the specified roles from session payload.
 */
export function requireAnyRoleFromSession(
  session: SessionPayload,
  roles: string[]
): void {
  const hasAnyRole = roles.some((role) => session.roles.includes(role));
  if (!hasAnyRole) {
    throw new ForbiddenError(`Requires one of ${roles.join(', ')} roles`);
  }
}

/**
 * Create an unauthorized response.
 */
export function unauthorizedResponse(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create a forbidden response.
 */
export function forbiddenResponse(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}
