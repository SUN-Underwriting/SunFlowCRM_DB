import { StackServerApp } from '@stackframe/stack';

/**
 * Stack Auth server app instance (lazy singleton).
 * Only created when actually requested AND when Stack Auth env vars are present.
 *
 * Requires STACK_SECRET_SERVER_KEY in environment variables.
 */
let _stackServerApp: StackServerApp | null = null;

/** Shared URL config for all StackServerApp instances. */
const STACK_AUTH_URLS = {
  signIn: '/auth/sign-in',
  afterSignIn: '/dashboard/overview',
  afterSignOut: '/auth/sign-in',
  home: '/dashboard/overview'
} as const;

/**
 * Validate Stack Auth credentials are properly configured.
 */
function validateStackAuthCredentials(): boolean {
  const secretKey = process.env.STACK_SECRET_SERVER_KEY;

  // Check if credentials are missing or still placeholder values
  if (
    !secretKey ||
    secretKey === 'your-secret-key-here' ||
    secretKey.includes('xxxx')
  ) {
    return false;
  }

  return true;
}

/**
 * Throw a descriptive error if Stack Auth credentials are not configured.
 */
function assertCredentials(): void {
  if (!validateStackAuthCredentials()) {
    const errorMsg = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Stack Auth не настроен!

Вы переключились на Stack Auth, но credentials не заполнены.

Пожалуйста:
1. Откройте https://app.stack-auth.com
2. Создайте проект
3. Скопируйте credentials в .env файл
4. Перезапустите: npm run dev

Или переключитесь обратно на SuperTokens в .env:
   AUTH_PROVIDER="supertokens"
   NEXT_PUBLIC_AUTH_PROVIDER="supertokens"

См. STACK_AUTH_SETUP.md для подробностей.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();

    console.error(errorMsg);
    throw new Error(
      'Stack Auth credentials not configured. See console for details.'
    );
  }
}

/**
 * Lazy singleton StackServerApp that reads cookies via next/headers cookies().
 * Suitable for Server Components and Server Actions.
 */
export function getStackServerApp(): StackServerApp {
  if (!_stackServerApp) {
    assertCredentials();

    _stackServerApp = new StackServerApp({
      tokenStore: 'nextjs-cookie',
      urls: STACK_AUTH_URLS
    });
  }
  return _stackServerApp;
}

/**
 * Create a request-scoped StackServerApp that reads cookies directly from
 * the incoming Request object.
 *
 * Use this in API Route Handlers where next/headers cookies() may not
 * reliably resolve the request context (Next.js 15+ async cookies issue).
 */
export function createRequestScopedStackApp(request: Request): StackServerApp {
  assertCredentials();

  return new StackServerApp({
    tokenStore: request,
    urls: STACK_AUTH_URLS
  });
}
