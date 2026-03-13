import { z } from 'zod';
import { UserRole, UserStatus } from '@prisma/client';

/**
 * Validation schemas for Settings API routes
 */

export const InviteUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.nativeEnum(UserRole),
  firstName: z.string().trim().min(1).max(50).optional(),
  lastName: z.string().trim().min(1).max(50).optional()
});

export type InviteUserInput = z.infer<typeof InviteUserSchema>;

export const UpdateUserSchema = z
  .object({
    role: z.nativeEnum(UserRole).optional(),
    status: z.nativeEnum(UserStatus).optional(),
    permissions: z.record(z.string(), z.unknown()).optional()
  })
  .refine((data) => data.role || data.status || data.permissions, {
    message: 'At least one field is required.',
    path: []
  });

export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const AuthSettingsSchema = z.object({
  inviteOnlyMode: z.boolean().optional(),
  requireEmailVerification: z.boolean().optional(),
  passwordMinLength: z.number().int().min(6).max(32).optional(),
  sessionLifetimeHours: z.number().int().positive().optional(),
  socialLoginEnabled: z.boolean().optional()
});

export type AuthSettingsInput = z.infer<typeof AuthSettingsSchema>;
