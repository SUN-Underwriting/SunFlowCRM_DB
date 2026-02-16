import EmailPasswordReact from 'supertokens-auth-react/recipe/emailpassword';
import SessionReact from 'supertokens-auth-react/recipe/session';
import { SuperTokensConfig } from 'supertokens-auth-react/lib/build/types';

const appInfo = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Next Shadcn Dashboard',
  apiDomain: process.env.NEXT_PUBLIC_API_DOMAIN || 'http://localhost:3000',
  websiteDomain: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE_PATH || '/api/auth',
  websiteBasePath: '/auth'
};

export const frontendConfig = (): SuperTokensConfig => {
  return {
    appInfo,
    recipeList: [
      EmailPasswordReact.init({
        signInAndUpFeature: {
          signUpForm: {
            formFields: [
              {
                id: 'email',
                label: 'Email',
                placeholder: 'Enter your email'
              },
              {
                id: 'password',
                label: 'Password',
                placeholder: 'Enter your password'
              }
            ]
          }
        }
      }),
      SessionReact.init({
        tokenTransferMethod: 'cookie',
        sessionTokenBackendDomain:
          process.env.NEXT_PUBLIC_SESSION_TOKEN_BACKEND_DOMAIN,
        // Redirect to sign-in when session is fully expired
        // instead of looping refresh attempts
        onHandleEvent: (context) => {
          if (context.action === 'UNAUTHORISED') {
            // Session expired and cannot be refreshed — redirect to login
            if (typeof window !== 'undefined') {
              const currentPath = window.location.pathname;
              // Don't redirect if already on auth pages
              if (!currentPath.startsWith('/auth')) {
                window.location.href = `/auth/sign-in?redirect=${encodeURIComponent(currentPath)}`;
              }
            }
          }
        },
        // Lower the retry limit to fail fast on expired sessions
        maxRetryAttemptsForSessionRefresh: 3
      })
    ],
    // Disable default UI routing (we use custom UI)
    disableAuthRoute: false,
    enableDebugLogs: process.env.NODE_ENV === 'development'
  };
};
