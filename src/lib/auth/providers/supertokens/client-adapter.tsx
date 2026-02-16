'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import SuperTokensReact from 'supertokens-auth-react';
import {
  SessionAuth,
  useSessionContext
} from 'supertokens-auth-react/recipe/session';
import {
  signIn as stSignIn,
  signOut as stSignOut
} from 'supertokens-web-js/recipe/emailpassword';
import { frontendConfig } from '@/lib/supertokens/frontend-config';
import type { AuthClientAdapter, SignInResult } from '../types';

/**
 * SuperTokens provider component
 */
function SuperTokensProvider({ children }: { children: React.ReactNode }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !initialized) {
      SuperTokensReact.init(frontendConfig());
      setInitialized(true);
    }
  }, [initialized]);

  if (!initialized) {
    return null;
  }

  // SessionAuth wrapper enables useSessionContext hook in child components
  // requireAuth=false allows unauthenticated pages to render
  return <SessionAuth requireAuth={false}>{children}</SessionAuth>;
}

/**
 * Session guard component for SuperTokens
 */
function SuperTokensSessionGuard({
  children,
  redirect = '/auth/sign-in'
}: {
  children: React.ReactNode;
  redirect?: string;
}) {
  const session = useSessionContext();
  const router = useRouter();

  useEffect(() => {
    if (!session.loading && !session.doesSessionExist) {
      const redirectUrl = new URL(redirect, window.location.origin);
      redirectUrl.searchParams.set('redirectToPath', window.location.pathname);
      router.push(redirectUrl.toString());
    }
  }, [session.loading, session.doesSessionExist, router, redirect]);

  if (session.loading || !session.doesSessionExist) {
    return null;
  }

  return <>{children}</>;
}

/**
 * Hook wrapper for SuperTokens session
 */
function useSupertokensSession() {
  const session = useSessionContext();

  return {
    user: session.doesSessionExist
      ? {
          id: session.userId,
          email: session.accessTokenPayload?.email || '',
          name:
            session.accessTokenPayload?.name ||
            session.accessTokenPayload?.email?.split('@')[0]
        }
      : null,
    loading: session.loading,
    authenticated: session.doesSessionExist
  };
}

/**
 * SuperTokens implementation of the AuthClientAdapter.
 * Wraps existing SuperTokens frontend functionality.
 */
export class SuperTokensClientAdapter implements AuthClientAdapter {
  Provider = SuperTokensProvider;

  useSession = useSupertokensSession;

  async signIn(email: string, password: string): Promise<SignInResult> {
    try {
      const response = await stSignIn({
        formFields: [
          { id: 'email', value: email },
          { id: 'password', value: password }
        ]
      });

      if (response.status === 'WRONG_CREDENTIALS_ERROR') {
        return { status: 'WRONG_CREDENTIALS' };
      }

      if (response.status === 'FIELD_ERROR') {
        return {
          status: 'FIELD_ERROR',
          message: response.formFields[0]?.error || 'Invalid field'
        };
      }

      if (response.status === 'SIGN_IN_NOT_ALLOWED') {
        return {
          status: 'SIGN_IN_NOT_ALLOWED',
          message: response.reason || 'Sign in not allowed'
        };
      }

      return { status: 'OK' };
    } catch (error) {
      console.error('[SuperTokensAdapter] Sign in error:', error);
      return {
        status: 'FIELD_ERROR',
        message: 'An unexpected error occurred'
      };
    }
  }

  async signOut(): Promise<void> {
    await stSignOut();
  }

  SessionGuard = SuperTokensSessionGuard;
}
