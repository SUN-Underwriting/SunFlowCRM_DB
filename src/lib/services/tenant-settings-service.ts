import { BaseService } from './base-service';
import { prisma } from '@/lib/db/prisma';
import { NotFoundError, ValidationError } from '@/lib/errors/app-errors';
import { z } from 'zod';

/**
 * TenantAuthSettings schema with validation
 * Best Practice (Context7): Define schemas for runtime validation
 */
export const TenantAuthSettingsSchema = z.object({
  allowSignup: z.boolean().optional(),
  allowGoogleAuth: z.boolean().optional(),
  allowGithubAuth: z.boolean().optional(),
  passwordMinLength: z.number().min(6).max(128).optional(),
  requireEmailVerification: z.boolean().optional(),
  sessionTimeoutMinutes: z.number().min(5).max(43200).optional(), // Max 30 days
  maxFailedLoginAttempts: z.number().min(1).max(100).optional()
});

export type TenantAuthSettings = z.infer<typeof TenantAuthSettingsSchema>;

export const DEFAULT_AUTH_SETTINGS: TenantAuthSettings = {
  allowSignup: false,
  allowGoogleAuth: false,
  allowGithubAuth: false,
  passwordMinLength: 8,
  requireEmailVerification: true,
  sessionTimeoutMinutes: 60,
  maxFailedLoginAttempts: 5
};

/**
 * TenantSettingsService - Manages tenant-level settings
 * Best Practice: Separate concerns - settings logic isolated from routes
 */
export class TenantSettingsService extends BaseService {
  /**
   * Get tenant auth settings
   */
  async getAuthSettings(): Promise<TenantAuthSettings> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: this.tenantId },
      select: { settings: true }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    // Type-safe settings extraction
    const settings = tenant.settings as Record<string, unknown>;
    const authSettings = (settings.auth || {}) as Partial<TenantAuthSettings>;

    return {
      ...DEFAULT_AUTH_SETTINGS,
      ...authSettings
    };
  }

  /**
   * Update tenant auth settings with validation
   * Best Practice: Validate all updates before persisting
   */
  async updateAuthSettings(
    updates: Partial<TenantAuthSettings>
  ): Promise<TenantAuthSettings> {
    // Validate updates
    const validation = TenantAuthSettingsSchema.partial().safeParse(updates);
    if (!validation.success) {
      throw new ValidationError(
        'Invalid auth settings',
        validation.error.flatten().fieldErrors
      );
    }

    // Fetch current settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: this.tenantId },
      select: { settings: true }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    const currentSettings = tenant.settings as Record<string, unknown>;
    const currentAuth = (currentSettings.auth ||
      {}) as Partial<TenantAuthSettings>;

    // Merge new settings
    const newAuthSettings: TenantAuthSettings = {
      ...DEFAULT_AUTH_SETTINGS,
      ...currentAuth,
      ...validation.data
    };

    const newSettings = {
      ...currentSettings,
      auth: newAuthSettings
    };

    // Update tenant
    await prisma.tenant.update({
      where: { id: this.tenantId },
      data: { settings: newSettings }
    });

    return newAuthSettings;
  }

  /**
   * Get full tenant info (for admin dashboard)
   */
  async getTenantInfo() {
    const tenant = await prisma.tenant.findUnique({
      where: { id: this.tenantId },
      select: {
        id: true,
        name: true,
        slug: true,
        plan: true,
        status: true,
        settings: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            users: true
          }
        }
      }
    });

    if (!tenant) {
      throw new NotFoundError('Tenant not found');
    }

    return tenant;
  }

  /**
   * Update tenant profile (name, slug)
   */
  async updateTenantProfile(input: { name?: string; slug?: string }) {
    const tenant = await prisma.tenant.update({
      where: { id: this.tenantId },
      data: input
    });

    return tenant;
  }
}
