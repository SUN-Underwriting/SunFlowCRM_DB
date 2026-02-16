'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  StackProvider,
  StackTheme,
  useUser,
  useStackApp
} from '@stackframe/stack';
import { getStackClientApp } from '@/stack/client';
import type { AuthClientAdapter, SignInResult } from '../types';

/**
 * Stack Auth provider component.
 * Uses the pre-configured stackClientApp instance from stack/client.ts.
 * StackTheme wraps children to ensure built-in Stack components
 * (OAuthButtonGroup, SignIn, etc.) are styled correctly.
 * Docs: https://docs.stack-auth.com/docs/components/stack-provider
 */
function StackAuthProvider({ children }: { children: React.ReactNode }) {
  const app = getStackClientApp();
  return (
    <StackProvider app={app}>
      <StackTheme>{children}</StackTheme>
    </StackProvider>
  );
}

/**
 * Session guard component for Stack Auth
 */
function StackAuthSessionGuard({
  children,
  redirect = '/auth/sign-in'
}: {
  children: React.ReactNode;
  redirect?: string;
}) {
  const user = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user === null) {
      // User is not authenticated
      const redirectUrl = new URL(redirect, window.location.origin);
      redirectUrl.searchParams.set('redirectToPath', window.location.pathname);
      router.push(redirectUrl.toString());
    }
  }, [user, router, redirect]);

  if (user === null || user === undefined) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Hook wrapper for Stack Auth session
 */
function useStackSession() {
  const user = useUser();

  return {
    user:
      user && user !== null
        ? {
            id: user.id,
            email: user.primaryEmail || '',
            name: user.displayName || user.primaryEmail?.split('@')[0] || ''
          }
        : null,
    loading: user === undefined,
    authenticated: user !== null && user !== undefined
  };
}

/**
 * Stack Auth implementation of the AuthClientAdapter.
 */
export class StackAuthClientAdapter implements AuthClientAdapter {
  Provider = StackAuthProvider;

  useSession = useStackSession;

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      // Stack Auth SDK: signInWithCredential
      // noRedirect: true — we manage the redirect ourselves in AuthForm
      const result = await getStackClientApp().signInWithCredential({
        email,
        password,
        noRedirect: true
      });

      if (result.status === 'error') {
        const msg = result.error?.message?.toLowerCase() || '';

        if (
          msg.includes('mismatch') ||
          msg.includes('credential') ||
          msg.includes('password')
        ) {
          return { status: 'WRONG_CREDENTIALS' };
        }

        return {
          status: 'FIELD_ERROR',
          message: result.error?.message || 'Sign in failed'
        };
      }

      return { status: 'OK' };
    } catch (error: any) {
      console.error('[StackAuthAdapter] Sign in error:', error);

      const msg = (error?.message || '').toLowerCase();

      if (
        msg.includes('mismatch') ||
        msg.includes('credential') ||
        msg.includes('password')
      ) {
        return { status: 'WRONG_CREDENTIALS' };
      }

      if (
        msg.includes('not enabled') ||
        msg.includes('credential authentication')
      ) {
        return {
          status: 'SIGN_IN_NOT_ALLOWED',
          message:
            'Password sign-in is not enabled. Please contact your administrator.'
        };
      }

      return {
        status: 'FIELD_ERROR',
        message: error?.message || 'Network error occurred'
      };
    }
  }

  async signOut(): Promise<void> {
    try {
      // Use Stack Auth SDK for sign out
      const user = await getStackClientApp().getUser();

      if (user) {
        await user.signOut();
      }

      // Reload to clear client state and redirect to sign-in
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/sign-in';
      }
    } catch (error) {
      console.error('[StackAuthAdapter] Sign out error:', error);
      // Still redirect on error
      if (typeof window !== 'undefined') {
        window.location.href = '/auth/sign-in';
      }
    }
  }

  SessionGuard = StackAuthSessionGuard;
}
