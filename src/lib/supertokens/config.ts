import SuperTokens from 'supertokens-node';
import EmailPasswordNode from 'supertokens-node/recipe/emailpassword';
import SessionNode from 'supertokens-node/recipe/session';
import DashboardNode from 'supertokens-node/recipe/dashboard';

const appInfo = {
  appName: process.env.NEXT_PUBLIC_APP_NAME || 'Next Shadcn Dashboard',
  apiDomain: process.env.NEXT_PUBLIC_API_DOMAIN || 'http://localhost:3000',
  websiteDomain: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  apiBasePath: process.env.NEXT_PUBLIC_API_BASE_PATH || '/api/auth',
  websiteBasePath: '/auth'
};

export const backendConfig = () => {
  return {
    framework: 'custom' as const,
    supertokens: {
      connectionURI:
        process.env.SUPERTOKENS_CONNECTION_URI || 'http://localhost:3567',
      apiKey: process.env.SUPERTOKENS_API_KEY
    },
    appInfo,
    recipeList: [
      DashboardNode.init(),
      EmailPasswordNode.init({
        override: {
          apis: (originalImplementation) => {
            return {
              ...originalImplementation,
              signUpPOST: async function (input) {
                // Disable public signup - users must be invited by admins
                throw new Error(
                  'Public signup is disabled. Please contact your administrator for an invitation.'
                );
              }
            };
          }
        }
      }),
      SessionNode.init({
        cookieSecure: process.env.NODE_ENV === 'production',
        cookieSameSite: 'lax',
        sessionExpiredStatusCode: 401,
        antiCsrf: 'VIA_TOKEN',
        override: {
          functions: (originalImplementation) => {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {
                // Fetch user data from SuperTokens
                const stUser = await SuperTokens.getUser(
                  input.userId,
                  input.userContext
                );

                // Extract email from user's login methods (EmailPassword)
                const email = stUser?.loginMethods.find(
                  (lm) => lm.recipeId === 'emailpassword'
                )?.email;

                // Get or create user in our application database
                // This links SuperTokens auth to our business user with tenant and role
                let appUser = null;
                if (!email) {
                  throw new Error('Email is required for session creation');
                }

                try {
                  // CRITICAL: First check if this user was invited
                  // This reconciles placeholder IDs with real SuperTokens IDs
                  const { reconcileInvitedUser } = await import(
                    '@/lib/auth/invite-reconciliation'
                  );
                  appUser = await reconcileInvitedUser(input.userId, email);

                  // If no invited user found, create new user (fallback)
                  if (!appUser) {
                    const { getOrCreateUser } = await import(
                      '@/lib/auth/user-service'
                    );
                    appUser = await getOrCreateUser(input.userId, email);
                  }
                } catch (error) {
                  console.error(
                    '[SuperTokens] Failed to get/create app user:',
                    error
                  );
                  // SECURITY: Do NOT create session without tenant context
                  throw new Error(
                    'Failed to initialize user session: tenant context could not be established'
                  );
                }

                // SECURITY: Validate tenant context before creating session
                if (!appUser || !appUser.tenantId) {
                  console.error(
                    '[SuperTokens] SECURITY: Attempted session creation without tenant context',
                    {
                      userId: input.userId,
                      email,
                      hasAppUser: !!appUser
                    }
                  );
                  throw new Error(
                    'Session creation failed: invalid tenant context'
                  );
                }

                // Add email, tenantId, and roles to access token payload
                input.accessTokenPayload = {
                  ...input.accessTokenPayload,
                  email,
                  tenantId: appUser.tenantId,
                  roles: [appUser.role] // Array for future multi-role support
                };

                return originalImplementation.createNewSession(input);
              }
            };
          }
        }
      })
    ],
    isInServerlessEnv: true
  };
};

// Track initialization state
let superTokensInitialized = false;

// Initialize SuperTokens
export function ensureSuperTokensInit() {
  if (!superTokensInitialized) {
    SuperTokens.init(backendConfig());
    superTokensInitialized = true;
  }
}
