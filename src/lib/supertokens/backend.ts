import { NextRequest, NextResponse } from 'next/server';
import { ensureSuperTokensInit } from './config';
import Session from 'supertokens-node/recipe/session';
import { SessionContainer } from 'supertokens-node/recipe/session';

ensureSuperTokensInit();

/**
 * Verify session from request
 * @param request Next.js request object
 * @returns Session container or null if no valid session
 */
export async function getSession(
  request: NextRequest
): Promise<SessionContainer | null> {
  try {
    // Context7: Use correct SuperTokens API for Next.js App Router
    // Pass request and undefined for response (not NextResponse.next())
    const session = await Session.getSession(request as any, undefined as any, {
      sessionRequired: false
    });
    return session || null;
  } catch (error) {
    console.error('Error getting session:', error);
    return null;
  }
}

/**
 * Verify session and require authentication
 * @param request Next.js request object
 * @throws Error if no valid session
 */
export async function requireAuth(
  request: NextRequest
): Promise<SessionContainer> {
  // Context7: Use correct SuperTokens API for Next.js App Router
  const session = await Session.getSession(request as any, undefined as any, {
    sessionRequired: true
  });

  if (!session) {
    throw new Error('Unauthorized');
  }

  return session;
}

/**
 * Get user ID from session
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  const session = await getSession(request);
  return session?.getUserId() || null;
}

/**
 * Sign out user
 */
export async function signOut(session: SessionContainer): Promise<void> {
  await session.revokeSession();
}
