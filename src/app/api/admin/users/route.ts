import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withRole } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody } from '@/lib/api/validation';
import { UserProvisioningService } from '@/lib/services/user-provisioning-service';
import { UserService } from '@/lib/services/user-service';

/**
 * Zod schema for admin user provisioning.
 * Password is optional — if omitted, Stack Auth sends a magic-link invite.
 * For SuperTokens, a placeholder auth ID is created (invite flow).
 */
const ProvisionUserSchema = z.object({
  email: z.email({ message: 'Valid email is required' }),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .optional(),
  firstName: z.string().max(100).optional(),
  lastName: z.string().max(100).optional(),
  role: z
    .enum(['ADMIN', 'MANAGER', 'UNDERWRITER', 'SALES', 'MEMBER'])
    .default('MEMBER')
});

/**
 * GET /api/admin/users
 * List all users in the admin's tenant.
 * Requires ADMIN role.
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
 * POST /api/admin/users
 * Provision a new user: creates in auth provider + our DB atomically.
 * Requires ADMIN role.
 *
 * Request body:
 *   { email, password?, firstName?, lastName?, role? }
 *
 * The user is created in Stack Auth (or SuperTokens) first,
 * then in our Prisma DB with proper tenant association.
 * If DB creation fails, the auth provider user is rolled back.
 */
export async function POST(request: NextRequest) {
  try {
    return await withRole(request, ['ADMIN'], async (currentUser) => {
      const body = await validateRequestBody(request, ProvisionUserSchema);

      const result = await UserProvisioningService.provisionUser(
        {
          email: body.email,
          password: body.password,
          firstName: body.firstName,
          lastName: body.lastName,
          role: body.role as any,
          tenantId: currentUser.tenantId
        },
        currentUser.id
      );

      return apiResponse(result, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
