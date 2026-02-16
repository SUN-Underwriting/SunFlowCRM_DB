'use client';

import React from 'react';
import { getAuthClientAdapter } from '@/lib/auth/providers/client-factory';

/**
 * Session authentication wrapper.
 * Works with both SuperTokens and Stack Auth via the adapter abstraction.
 * Protects routes by requiring a valid session; redirects to /auth/sign-in if none exists.
 */
export function SessionAuth({ children }: { children: React.ReactNode }) {
  const adapter = getAuthClientAdapter();
  const Guard = adapter.SessionGuard;

  return <Guard redirect='/auth/sign-in'>{children}</Guard>;
}
