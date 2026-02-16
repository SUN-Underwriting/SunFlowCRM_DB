import { NextRequest, NextResponse } from 'next/server';
import { withSession } from 'supertokens-node/nextjs';
import { getAppDirRequestHandler } from 'supertokens-node/nextjs';
import SuperTokens from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { ensureSuperTokensInit } from '@/lib/supertokens/config';
import type {
  AuthServerAdapter,
  SessionPayload,
  CreateSessionResult,
  AuthUser
} from '../types';

/**
 * SuperTokens implementation of the AuthServerAdapter.
 * Wraps existing SuperTokens functionality into the common adapter interface.
 */
export class SuperTokensServerAdapter implements AuthServerAdapter {
  init(): void {
    ensureSuperTokensInit();
  }

  async getSession(request: NextRequest): Promise<SessionPayload | null> {
    return new Promise((resolve) => {
      withSession(request, async (err, session) => {
        if (err || !session) {
          resolve(null);
          return NextResponse.json({ error: 'No session' }, { status: 401 });
        }

        try {
          const payload = session.getAccessTokenPayload();

          // Critical: Enforce tenantId presence
          if (!payload.tenantId) {
            console.error(
              '[SuperTokensAdapter] SECURITY: Session missing tenantId:',
              {
                userId: session.getUserId(),
                email: payload.email
              }
            );
            resolve(null);
            return NextResponse.json(
              { error: 'Invalid session: missing tenant context' },
              { status: 401 }
            );
          }

          resolve({
            userId: session.getUserId(),
            tenantId: payload.tenantId,
            roles: Array.isArray(payload.roles) ? payload.roles : [],
            email: payload.email
          });
        } catch (error) {
          console.error('[SuperTokensAdapter] getSession error:', error);
          resolve(null);
        }

        return NextResponse.json({ ok: true });
      });
    });
  }

  async createSession(
    userId: string,
    email: string,
    tenantId: string,
    roles: string[]
  ): Promise<CreateSessionResult> {
    // SuperTokens creates sessions automatically during sign-in via the override
    // This method is used when we need to update session payload
    // In practice, the session creation happens in config.ts override
    return {
      userId,
      accessToken: undefined // SuperTokens manages tokens via cookies
    };
  }

  async revokeSession(request: NextRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      withSession(request, async (err, session) => {
        if (err || !session) {
          resolve();
          return NextResponse.json({ error: 'No session' }, { status: 401 });
        }

        try {
          await session.revokeSession();
          resolve();
        } catch (error) {
          reject(error);
        }

        return NextResponse.json({ ok: true });
      });
    });
  }

  async createUser(email: string, password: string): Promise<string> {
    const response = await EmailPassword.signUp('public', email, password);

    if (response.status === 'OK') {
      return response.user.id;
    } else if (response.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
      throw new Error('Email already exists');
    } else {
      throw new Error('Failed to create user');
    }
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    const user = await SuperTokens.getUser(userId);

    if (!user) {
      return null;
    }

    // Extract email from EmailPassword login method
    const emailPasswordMethod = user.loginMethods.find(
      (lm) => lm.recipeId === 'emailpassword'
    );

    if (!emailPasswordMethod?.email) {
      return null;
    }

    return {
      id: user.id,
      email: emailPasswordMethod.email
    };
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const updateResponse = await EmailPassword.updateEmailOrPassword({
      recipeUserId: { getAsString: () => userId } as any,
      password: newPassword
    });

    if (updateResponse.status !== 'OK') {
      throw new Error('Failed to update password');
    }
  }

  async deleteUser(userId: string): Promise<void> {
    await SuperTokens.deleteUser(userId);
  }

  getApiHandler(): (request: NextRequest) => Promise<NextResponse> {
    const handleCall = getAppDirRequestHandler();

    return async (request: NextRequest) => {
      const res = await handleCall(request);

      // Critical for production - prevent caching of auth endpoints
      if (!res.headers.has('Cache-Control')) {
        res.headers.set(
          'Cache-Control',
          'no-cache, no-store, max-age=0, must-revalidate'
        );
      }

      return res;
    };
  }

  hasValidSessionCookie(request: NextRequest): boolean {
    const accessToken =
      request.cookies.get('sAccessToken')?.value ||
      request.cookies.get('st-access-token')?.value;

    return !!accessToken;
  }
}
