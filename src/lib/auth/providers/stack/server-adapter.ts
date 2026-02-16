import { NextRequest, NextResponse } from 'next/server';
import { getStackServerApp, createRequestScopedStackApp } from '@/stack/server';
import type { StackServerApp } from '@stackframe/stack';
import type {
  AuthServerAdapter,
  SessionPayload,
  CreateSessionResult,
  AuthUser
} from '../types';

/**
 * Stack Auth implementation of the AuthServerAdapter.
 * Uses the lazy getStackServerApp() to avoid loading at import time.
 */
export class StackAuthServerAdapter implements AuthServerAdapter {
  private get app(): StackServerApp {
    return getStackServerApp();
  }

  init(): void {
    // Stack Auth app is already initialized via import
    // No additional initialization needed
  }

  async getSession(request: NextRequest): Promise<SessionPayload | null> {
    try {
      // Read cookies directly from the incoming request instead of relying on
      // next/headers cookies(), which can fail in API Route Handlers on Next.js 15+.
      const requestApp = createRequestScopedStackApp(request);
      const user = await requestApp.getUser();

      if (!user) {
        return null;
      }

      // Extract custom metadata (tenantId, roles)
      const metadata = (user.serverMetadata || {}) as {
        tenantId?: string;
        roles?: string[];
      };

      let tenantId = metadata.tenantId;
      let roles = metadata.roles || [];

      // If user has no tenantId in serverMetadata, resolve via UserProvisioningService.
      // This handles: invited users, users created via Dashboard, and dev auto-provisioning.
      if (!tenantId) {
        console.warn(
          '[StackAuthAdapter] User missing tenantId, resolving via provisioning:',
          {
            userId: user.id,
            email: user.primaryEmail
          }
        );

        try {
          const { UserProvisioningService } = await import(
            '@/lib/services/user-provisioning-service'
          );

          const result = await UserProvisioningService.syncFromAuthProvider({
            authUserId: user.id,
            email: user.primaryEmail || '',
            displayName: user.displayName || undefined
          });

          tenantId = result.user.tenantId;
          roles = [result.user.role];

          // Persist to Stack Auth serverMetadata so next request skips this step
          await user
            .update({
              serverMetadata: { tenantId, roles }
            })
            .catch((e: any) => {
              console.warn(
                '[StackAuthAdapter] Failed to sync serverMetadata:',
                e.message
              );
            });
        } catch (provisionError) {
          console.error(
            '[StackAuthAdapter] Provisioning failed:',
            provisionError
          );
        }
      }

      if (!tenantId) {
        console.error(
          '[StackAuthAdapter] SECURITY: Cannot resolve tenantId for user:',
          {
            userId: user.id,
            email: user.primaryEmail
          }
        );
        return null;
      }

      return {
        userId: user.id,
        email: user.primaryEmail || undefined,
        tenantId,
        roles
      };
    } catch (error) {
      console.error('[StackAuthAdapter] getSession error:', error);
      return null;
    }
  }

  async createSession(
    userId: string,
    email: string,
    tenantId: string,
    roles: string[]
  ): Promise<CreateSessionResult> {
    try {
      // Stack Auth creates sessions automatically during sign-in
      // This method updates the user's metadata with tenant context
      const user = await this.app.getUser(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Update server metadata with tenant and roles
      await user.update({
        serverMetadata: {
          tenantId,
          roles
        }
      });

      return {
        userId,
        accessToken: undefined // Stack Auth manages tokens via cookies
      };
    } catch (error) {
      console.error('[StackAuthAdapter] createSession error:', error);
      throw error;
    }
  }

  async revokeSession(request: NextRequest): Promise<void> {
    try {
      const requestApp = createRequestScopedStackApp(request);
      const user = await requestApp.getUser();
      if (user) {
        await user.signOut();
      }
    } catch (error) {
      console.error('[StackAuthAdapter] revokeSession error:', error);
      // Don't throw - sign out should be graceful
    }
  }

  async createUser(email: string, password: string): Promise<string> {
    try {
      // Stack Auth user creation via server API
      const user = await this.app.createUser({
        primaryEmail: email,
        password
      });

      return user.id;
    } catch (error) {
      console.error('[StackAuthAdapter] createUser error:', error);
      throw new Error('Failed to create user');
    }
  }

  async getUserById(userId: string): Promise<AuthUser | null> {
    try {
      const user = await this.app.getUser(userId);

      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.primaryEmail || ''
      };
    } catch (error) {
      console.error('[StackAuthAdapter] getUserById error:', error);
      return null;
    }
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    try {
      const user = await this.app.getUser(userId);

      if (!user) {
        throw new Error('User not found');
      }

      await user.update({
        password: newPassword
      });
    } catch (error) {
      console.error('[StackAuthAdapter] updateUserPassword error:', error);
      throw new Error('Failed to update password');
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const user = await this.app.getUser(userId);

      if (user) {
        await user.delete();
      }
    } catch (error) {
      console.error('[StackAuthAdapter] deleteUser error:', error);
      throw new Error('Failed to delete user');
    }
  }

  getApiHandler(): (request: NextRequest) => Promise<NextResponse> {
    // Stack Auth uses /handler/[...stack]/page.tsx for auth UI flows
    // The /api/auth/* route can be a passthrough or redirect to /handler/
    return async (request: NextRequest) => {
      const pathname = request.nextUrl.pathname;

      // Map common auth endpoints to Stack Auth handler routes
      if (pathname === '/api/auth/signin') {
        return NextResponse.redirect(new URL('/handler/sign-in', request.url));
      }

      if (pathname === '/api/auth/signout') {
        return NextResponse.redirect(new URL('/handler/sign-out', request.url));
      }

      // For other auth routes, let Stack Auth SDK handle via /handler/
      return NextResponse.json(
        { message: 'Stack Auth uses /handler/* routes for authentication' },
        { status: 200 }
      );
    };
  }

  hasValidSessionCookie(request: NextRequest): boolean {
    // Stack Auth SDK cookie names (from @stackframe/stack source):
    // - Access token:  "stack-access" (fixed name)
    // - Refresh token: "stack-refresh-{projectId}" (new) or "stack-refresh" (legacy)
    if (request.cookies.get('stack-access')?.value) {
      return true;
    }

    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith('stack-refresh')) {
        return true;
      }
    }

    return false;
  }
}
