'use client';

import { getAuthClientAdapter } from '@/lib/auth/providers/client-factory';

/**
 * Custom hook for accessing user authentication data.
 * Works with both SuperTokens and Stack Auth via the adapter abstraction.
 *
 * @example
 * const { tenantId, roles, hasRole, isAdmin } = useAuth();
 * if (isAdmin()) { ... }
 * if (hasRole('UNDERWRITER')) { ... }
 */
export function useAuth() {
  const adapter = getAuthClientAdapter();
  const session = adapter.useSession();

  if (session.loading) {
    return {
      loading: true,
      authenticated: false,
      tenantId: undefined,
      roles: [] as string[],
      email: undefined,
      userId: undefined,
      hasRole: () => false,
      isAdmin: () => false,
      isManager: () => false
    } as const;
  }

  if (!session.authenticated || !session.user) {
    return {
      loading: false,
      authenticated: false,
      tenantId: undefined,
      roles: [] as string[],
      email: undefined,
      userId: undefined,
      hasRole: () => false,
      isAdmin: () => false,
      isManager: () => false
    } as const;
  }

  const { user } = session;
  // TODO: Extract tenantId and roles from provider-specific session data
  // For now we use metadata from the adapter session if available
  const tenantId = (user as any).tenantId as string | undefined;
  const roles = ((user as any).roles ?? []) as string[];
  const email = user.email;
  const userId = user.id;

  const hasRole = (role: string) => roles.includes(role);
  const isAdmin = () => hasRole('ADMIN');
  const isManager = () => hasRole('MANAGER') || isAdmin();

  return {
    loading: false,
    authenticated: true,
    tenantId,
    roles,
    email,
    userId,
    hasRole,
    isAdmin,
    isManager
  } as const;
}

export type AuthState = ReturnType<typeof useAuth>;
