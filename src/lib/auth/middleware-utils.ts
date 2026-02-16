/**
 * Middleware-specific auth utilities optimized for Edge Runtime.
 *
 * These functions avoid heavy imports and class instantiations,
 * providing fast cookie checks for route protection.
 */
import { NextRequest } from 'next/server';

type AuthProviderType = 'supertokens' | 'stack';

/**
 * Get the configured auth provider type.
 * Reads directly from env without importing heavy modules.
 */
function getAuthProviderType(): AuthProviderType {
  const provider = process.env.AUTH_PROVIDER || 'supertokens';
  return (provider === 'stack' ? 'stack' : 'supertokens') as AuthProviderType;
}

/**
 * Fast cookie presence check for SuperTokens sessions.
 */
function hasSuperTokensCookie(request: NextRequest): boolean {
  return (
    !!request.cookies.get('sAccessToken')?.value ||
    !!request.cookies.get('sFrontToken')?.value
  );
}

/**
 * Fast cookie presence check for Stack Auth sessions.
 *
 * Stack Auth SDK cookie names (from @stackframe/stack source):
 * - Access token:  "stack-access" (fixed name)
 * - Refresh token: "stack-refresh-{projectId}" (new) or "stack-refresh" (legacy)
 */
function hasStackAuthCookie(request: NextRequest): boolean {
  // Fixed access-token cookie name — always present after sign-in
  if (request.cookies.get('stack-access')?.value) {
    return true;
  }

  // Check for project-specific refresh token (stack-refresh-{projectId})
  // and legacy "stack-refresh" cookie
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith('stack-refresh')) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a valid session cookie exists for the current auth provider.
 *
 * This is a lightweight check optimized for Edge Runtime middleware.
 * It only checks for cookie presence, not validity.
 *
 * Full session validation happens server-side in API routes.
 */
export function hasValidSessionCookie(request: NextRequest): boolean {
  const provider = getAuthProviderType();

  if (provider === 'stack') {
    return hasStackAuthCookie(request);
  }

  return hasSuperTokensCookie(request);
}
