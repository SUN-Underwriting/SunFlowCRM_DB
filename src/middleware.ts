import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Protected route prefixes that require authentication.
 * If no session cookie is present, the user is redirected to sign-in.
 *
 * Note: This is a fast, cookie-presence check — not a full session
 * validation.  Full validation still happens server-side in API routes
 * via `withCurrentUser` / `withRole`.
 */
const PROTECTED_PREFIXES = ['/dashboard', '/settings'];

/**
 * Routes that should never be protected (auth pages, public pages).
 */
const PUBLIC_PREFIXES = ['/auth', '/api/auth', '/_next', '/monitoring'];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Never interfere with public / auth routes
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // For protected routes, check if a SuperTokens session cookie exists.
  // SuperTokens uses "sAccessToken" for cookie-based sessions.
  if (isProtected(pathname)) {
    const accessToken =
      request.cookies.get('sAccessToken')?.value ||
      request.cookies.get('st-access-token')?.value;

    if (!accessToken) {
      const signInUrl = new URL('/auth/sign-in', request.url);
      // Preserve the intended destination so we can redirect after login
      signInUrl.searchParams.set('redirectToPath', pathname);
      return NextResponse.redirect(signInUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)'
  ]
};
