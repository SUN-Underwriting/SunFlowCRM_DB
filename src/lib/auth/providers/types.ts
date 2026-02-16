import { NextRequest, NextResponse } from 'next/server';
import React from 'react';

/**
 * Common session payload format used across all auth providers.
 * This is the normalized format that application code works with.
 */
export interface SessionPayload {
  userId: string;
  tenantId: string;
  roles: string[];
  email?: string;
}

/**
 * Result of creating a new session.
 */
export interface CreateSessionResult {
  userId: string;
  accessToken?: string;
}

/**
 * Result of sign-in operation.
 */
export type SignInResult =
  | { status: 'OK' }
  | { status: 'WRONG_CREDENTIALS' }
  | { status: 'FIELD_ERROR'; message: string }
  | { status: 'SIGN_IN_NOT_ALLOWED'; message: string };

/**
 * User data from auth provider (minimal interface).
 */
export interface AuthUser {
  id: string;
  email: string;
}

/**
 * Server-side auth adapter interface.
 * All auth providers must implement this interface for backend operations.
 */
export interface AuthServerAdapter {
  /**
   * Initialize the auth provider (e.g., call SuperTokens.init()).
   * Called once during application startup.
   */
  init(): void | Promise<void>;

  /**
   * Get the current session from the request.
   * Returns null if no valid session exists.
   */
  getSession(request: NextRequest): Promise<SessionPayload | null>;

  /**
   * Create a new session for a user.
   * This is typically called after user creation/reconciliation.
   */
  createSession(
    userId: string,
    email: string,
    tenantId: string,
    roles: string[]
  ): Promise<CreateSessionResult>;

  /**
   * Revoke/delete the current session.
   */
  revokeSession(request: NextRequest): Promise<void>;

  /**
   * Create a new user in the auth provider.
   * Returns the auth provider's user ID.
   */
  createUser(email: string, password: string): Promise<string>;

  /**
   * Get user by auth provider's user ID.
   */
  getUserById(userId: string): Promise<AuthUser | null>;

  /**
   * Update user's password.
   */
  updateUserPassword(userId: string, newPassword: string): Promise<void>;

  /**
   * Delete user from auth provider.
   */
  deleteUser(userId: string): Promise<void>;

  /**
   * Get the API route handler for this auth provider.
   * This handles routes like /api/auth/signin, /api/auth/signout, etc.
   */
  getApiHandler(): (request: NextRequest) => Promise<NextResponse>;

  /**
   * Check if the request has a valid session cookie (fast check for middleware).
   * Does NOT validate the session - just checks cookie presence.
   */
  hasValidSessionCookie(request: NextRequest): boolean;
}

/**
 * Client-side auth adapter interface.
 * All auth providers must implement this interface for frontend operations.
 */
export interface AuthClientAdapter {
  /**
   * React provider component that wraps the application.
   * Provides auth context to child components.
   */
  Provider: React.ComponentType<{ children: React.ReactNode }>;

  /**
   * Hook to access current session state.
   * Returns user info, loading state, and authentication status.
   */
  useSession: () => {
    user: { email: string; name?: string; id: string } | null;
    loading: boolean;
    authenticated: boolean;
  };

  /**
   * Sign in with email and password.
   */
  signIn: (email: string, password: string) => Promise<SignInResult>;

  /**
   * Sign out the current user.
   */
  signOut: () => Promise<void>;

  /**
   * Component that protects routes - redirects if not authenticated.
   */
  SessionGuard: React.ComponentType<{
    children: React.ReactNode;
    redirect?: string;
  }>;
}

/**
 * Type of auth provider.
 */
export type AuthProviderType = 'supertokens' | 'stack';
