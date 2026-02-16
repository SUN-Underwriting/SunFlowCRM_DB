import type { AuthServerAdapter, AuthProviderType } from './types';

/**
 * Get the configured auth provider type from environment variables.
 */
export function getAuthProviderType(): AuthProviderType {
  const provider = process.env.AUTH_PROVIDER || 'supertokens';

  if (provider !== 'supertokens' && provider !== 'stack') {
    console.warn(
      `[AuthFactory] Invalid AUTH_PROVIDER: ${provider}. Falling back to 'supertokens'`
    );
    return 'supertokens';
  }

  return provider;
}

/**
 * Create a new auth server adapter instance based on environment configuration.
 *
 * Uses dynamic imports so that Stack Auth modules are NOT loaded
 * when the provider is SuperTokens (and vice-versa).
 */
async function createAuthServerAdapter(): Promise<AuthServerAdapter> {
  const provider = getAuthProviderType();

  if (provider === 'stack') {
    const { StackAuthServerAdapter } = await import('./stack/server-adapter');
    const adapter = new StackAuthServerAdapter();
    adapter.init();
    return adapter;
  }

  // Default: supertokens
  const { SuperTokensServerAdapter } = await import(
    './supertokens/server-adapter'
  );
  const adapter = new SuperTokensServerAdapter();
  adapter.init();
  return adapter;
}

/**
 * Singleton instance of the auth adapter.
 * Cached to avoid re-initialization on every request.
 */
let cachedAdapter: AuthServerAdapter | null = null;
let adapterPromise: Promise<AuthServerAdapter> | null = null;

/**
 * Get the auth server adapter singleton (async).
 * Automatically selects the provider based on AUTH_PROVIDER env variable.
 *
 * Uses dynamic imports so only the selected provider is loaded.
 *
 * @example
 * const authAdapter = await getAuthAdapter();
 * const session = await authAdapter.getSession(request);
 */
export async function getAuthAdapter(): Promise<AuthServerAdapter> {
  if (cachedAdapter) {
    return cachedAdapter;
  }

  if (!adapterPromise) {
    adapterPromise = createAuthServerAdapter().then((adapter) => {
      cachedAdapter = adapter;
      return adapter;
    });
  }

  return adapterPromise;
}

/**
 * Reset the cached adapter (useful for testing).
 * @internal
 */
export function resetAuthAdapter(): void {
  cachedAdapter = null;
  adapterPromise = null;
}
