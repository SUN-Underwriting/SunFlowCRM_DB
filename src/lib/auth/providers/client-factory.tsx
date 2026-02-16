'use client';

import type { AuthClientAdapter, AuthProviderType } from './types';

/**
 * Get the configured auth provider type from environment variables (client-side).
 */
export function getAuthProviderType(): AuthProviderType {
  const provider = process.env.NEXT_PUBLIC_AUTH_PROVIDER || 'supertokens';

  if (provider !== 'supertokens' && provider !== 'stack') {
    console.warn(
      `[AuthClientFactory] Invalid NEXT_PUBLIC_AUTH_PROVIDER: ${provider}. Falling back to 'supertokens'`
    );
    return 'supertokens';
  }

  return provider;
}

/**
 * Create a new auth client adapter instance based on environment configuration.
 *
 * Uses synchronous require() to avoid async complexity in React client code,
 * while still keeping the unused provider out of the bundle via conditional logic.
 *
 * Note: Next.js/Turbopack will tree-shake the unused branch at build time
 * when NEXT_PUBLIC_AUTH_PROVIDER is inlined.
 */
function createAuthClientAdapter(): AuthClientAdapter {
  const provider = getAuthProviderType();

  if (provider === 'stack') {
    // Dynamic require so Stack Auth modules are not loaded when using SuperTokens
    const { StackAuthClientAdapter } = require('./stack/client-adapter');
    return new StackAuthClientAdapter();
  }

  // Default: supertokens
  const { SuperTokensClientAdapter } = require('./supertokens/client-adapter');
  return new SuperTokensClientAdapter();
}

/**
 * Singleton instance of the auth client adapter.
 */
let cachedAdapter: AuthClientAdapter | null = null;

/**
 * Get the auth client adapter singleton.
 * Automatically selects the provider based on NEXT_PUBLIC_AUTH_PROVIDER env variable.
 *
 * @example
 * const authAdapter = getAuthClientAdapter();
 * const { user, loading } = authAdapter.useSession();
 */
export function getAuthClientAdapter(): AuthClientAdapter {
  if (!cachedAdapter) {
    cachedAdapter = createAuthClientAdapter();
  }
  return cachedAdapter;
}

/**
 * Reset the cached adapter (useful for testing).
 * @internal
 */
export function resetAuthClientAdapter(): void {
  cachedAdapter = null;
}
