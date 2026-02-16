import { NextRequest } from 'next/server';
import { withRole } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  TenantSettingsService,
  TenantAuthSettingsSchema
} from '@/lib/services/tenant-settings-service';
import { ValidationError } from '@/lib/errors/app-errors';

/**
 * GET /api/settings/tenant/auth
 * Get tenant auth settings.
 * Requires ADMIN role.
 *
 * Best Practice: Use service layer for business logic separation
 */
export async function GET(request: NextRequest) {
  try {
    return await withRole(request, ['ADMIN'], async (user) => {
      const settingsService = new TenantSettingsService(user.tenantId, user.id);

      const authSettings = await settingsService.getAuthSettings();

      return apiResponse(authSettings);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * PUT /api/settings/tenant/auth
 * Update tenant auth settings.
 * Requires ADMIN role.
 * Context7: Use safeParse for structured validation errors
 */
export async function PUT(request: NextRequest) {
  try {
    return await withRole(request, ['ADMIN'], async (user) => {
      const settingsService = new TenantSettingsService(user.tenantId, user.id);

      const body = await request.json();
      const validation = TenantAuthSettingsSchema.safeParse(body);

      if (!validation.success) {
        throw new ValidationError(
          'Validation failed',
          validation.error.flatten().fieldErrors
        );
      }

      const updatedSettings = await settingsService.updateAuthSettings(
        validation.data
      );

      return apiResponse(updatedSettings);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
