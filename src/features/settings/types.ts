import { UserRole, UserStatus } from '@prisma/client';

export interface TenantAuthSettings {
  emailVerificationRequired: boolean;
  allowSocialLogin: boolean;
  inviteOnly: boolean;
  passwordMinLength: number;
  sessionLifetimeMinutes: number;
}

export const DEFAULT_AUTH_SETTINGS: TenantAuthSettings = {
  emailVerificationRequired: false,
  allowSocialLogin: false,
  inviteOnly: false,
  passwordMinLength: 8,
  sessionLifetimeMinutes: 60 * 24 * 30 // 30 days default
};

export interface UserWithDetails {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  lastOnline: Date | null;
  // Computed fields for display
  displayName: string;
  initials: string;
  permissions?: Record<string, unknown> | null;
}

export interface InviteUserRequest {
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserRequest {
  role?: UserRole;
  status?: UserStatus;
  permissions?: Record<string, unknown>;
}
