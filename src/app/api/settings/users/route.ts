import { NextRequest } from 'next/server';
import { withRole } from '@/lib/auth/get-current-user';
import { InviteUserSchema } from '@/features/settings/validation';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { ValidationError } from '@/lib/errors/app-errors';
import { UserService } from '@/lib/services/user-service';

/**
 * GET /api/settings/users
 * List users for the current tenant.
 * Requires ADMIN role.
 *
 * Best Practice: Use service layer instead of direct Prisma access
 */
export async function GET(request: NextRequest) {
  try {
    return await withRole(request, ['ADMIN'], async (user) => {
      const userService = new UserService(user.tenantId, user.id);

      const users = await userService.list();

      return apiResponse({ users });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/settings/users
 * Invite a new user to the tenant.
 * Requires ADMIN role.
 */
export async function POST(request: NextRequest) {
  try {
    return await withRole(request, ['ADMIN'], async (user) => {
      const userService = new UserService(user.tenantId, user.id);

      const body = await request.json();

      // Validate request body with Zod
      const validation = InviteUserSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError(
          'Validation failed',
          validation.error.flatten().fieldErrors
        );
      }

      const newUser = await userService.inviteUser(validation.data);

      return apiResponse(newUser, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
