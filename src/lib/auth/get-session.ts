import { withSession } from 'supertokens-node/nextjs';
import { NextRequest, NextResponse } from 'next/server';
import { ensureSuperTokensInit } from '@/lib/supertokens/config';
import { runInRequestContext } from '@/lib/db/rls-context';
import {
  UnauthorizedError,
  TenantContextMissingError,
  ForbiddenError
} from '@/lib/errors/app-errors';
import type { SessionContainer } from 'supertokens-node/recipe/session';

// Ensure SuperTokens is initialized
ensureSuperTokensInit();

/**
 * Session payload extracted from SuperTokens access token.
 * Contains user info including tenantId and roles for RBAC.
 */
export interface SessionPayload {
  userId: string;
  tenantId: string;
  roles: string[];
  email?: string;
}

/**
 * Extract session payload from SuperTokens SessionContainer.
 * Helper to reduce code duplication.
 */
function extractSessionPayload(session: SessionContainer): SessionPayload {
  const payload = session.getAccessTokenPayload();

  // Critical: Enforce tenantId presence
  if (!payload.tenantId) {
    console.error('[Auth] SECURITY: Session missing tenantId:', {
      userId: session.getUserId(),
      email: payload.email
    });
    throw new TenantContextMissingError(
      'Invalid session: missing tenant context'
    );
  }

  return {
    userId: session.getUserId(),
    tenantId: payload.tenantId,
    roles: Array.isArray(payload.roles) ? payload.roles : [],
    email: payload.email
  };
}

/**
 * Get session payload without setting up RLS context.
 * Useful for read-only operations that don't need DB access.
 */
export async function getSessionPayload(
  request: NextRequest
): Promise<SessionPayload | null> {
  return new Promise((resolve) => {
    withSession(request, async (err, session) => {
      if (err || !session) {
        resolve(null);
        return NextResponse.json({ error: 'No session' }, { status: 401 });
      }

      try {
        resolve(extractSessionPayload(session));
      } catch (error) {
        console.error('[Auth] getSessionPayload error:', error);
        resolve(null);
      }

      return NextResponse.json({ ok: true });
    });
  });
}

/**
 * Run a handler within a properly isolated async RLS context.
 * Uses SuperTokens' withSession helper for proper cookie handling.
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
  return withSession(request, async (err, session) => {
    // Handle SuperTokens errors
    if (err) {
      console.error('[Auth] SuperTokens session error:', err);
      throw new UnauthorizedError('Session error');
    }

    // No session exists
    if (!session) {
      throw new UnauthorizedError('No valid session');
    }

    const sessionPayload = extractSessionPayload(session);

    // Run handler within RLS context
    return runInRequestContext(
      {
        tenantId: sessionPayload.tenantId,
        userId: sessionPayload.userId
      },
      () => handler(sessionPayload)
    );
  });
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
