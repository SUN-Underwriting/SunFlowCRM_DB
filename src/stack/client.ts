'use client';

import { StackClientApp } from '@stackframe/stack';

/**
 * Stack Auth client app instance (lazy singleton).
 * Only created when actually requested AND when Stack Auth env vars are present.
 *
 * Requires NEXT_PUBLIC_STACK_PROJECT_ID and NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY.
 */
let _stackClientApp: StackClientApp | null = null;

/**
 * Validate Stack Auth credentials are properly configured.
 */
function validateStackAuthCredentials(): boolean {
  const projectId = process.env.NEXT_PUBLIC_STACK_PROJECT_ID;
  const publishableKey = process.env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY;

  // Check if credentials are missing or still placeholder values
  if (
    !projectId ||
    !publishableKey ||
    projectId === 'your-project-id-here' ||
    publishableKey === 'your-publishable-key-here' ||
    projectId.includes('xxxx') ||
    publishableKey.includes('xxxx')
  ) {
    return false;
  }

  return true;
}

export function getStackClientApp(): StackClientApp {
  if (!_stackClientApp) {
    // Validate credentials before creating the app
    if (!validateStackAuthCredentials()) {
      const errorMsg = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  Stack Auth не настроен!

Вы переключились на Stack Auth, но credentials не заполнены.

Пожалуйста:
1. Откройте https://app.stack-auth.com
2. Создайте проект
3. Скопируйте credentials в .env файл:

   NEXT_PUBLIC_STACK_PROJECT_ID="proj_..."
   NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY="pck_..."
   STACK_SECRET_SERVER_KEY="ssk_..."

4. Перезапустите: npm run dev

Или переключитесь обратно на SuperTokens:
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

    _stackClientApp = new StackClientApp({
      tokenStore: 'nextjs-cookie',
      urls: {
        signIn: '/auth/sign-in',
        afterSignIn: '/dashboard/overview',
        afterSignOut: '/auth/sign-in',
        home: '/dashboard/overview'
      }
    });
  }
  return _stackClientApp;
}
