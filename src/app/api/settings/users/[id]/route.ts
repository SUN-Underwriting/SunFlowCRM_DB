import { NextRequest } from 'next/server';
import { withRole } from '@/lib/auth/get-current-user';
import { prisma } from '@/lib/db/prisma';
import { UpdateUserSchema } from '@/features/settings/validation';
import { UserRole, UserStatus } from '@prisma/client';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { ValidationError, BusinessRuleError } from '@/lib/errors/app-errors';
import { UserService } from '@/lib/services/user-service';
import { CommonSchemas } from '@/lib/api/validation';

/**
 * PUT /api/settings/users/[id]
 * Update user role or status.
 * Requires ADMIN role.
 *
 * Best Practice: Use service layer for business logic
 */
export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const validatedId = CommonSchemas.id.parse(id);
    const body = await request.json();

    return await withRole(request, ['ADMIN'], async (user) => {
      const userService = new UserService(user.tenantId, user.id);

      const validation = UpdateUserSchema.safeParse(body);
      if (!validation.success) {
        throw new ValidationError(
          'Validation failed',
          validation.error.flatten().fieldErrors
        );
      }
      const updateData = validation.data;

      // Verify user belongs to the same tenant (service validates)
      const targetUser = await userService.getById(validatedId);

      // Prevent self-lockout if this is the last active admin
      if (targetUser.id === user.id) {
        const nextRole = updateData.role ?? targetUser.role;
        const nextStatus = updateData.status ?? targetUser.status;
        const isDemotingOrDisabling =
          nextRole !== UserRole.ADMIN || nextStatus !== UserStatus.ACTIVE;

        if (isDemotingOrDisabling) {
          const activeAdminCount = await prisma.user.count({
            where: {
              tenantId: user.tenantId,
              role: UserRole.ADMIN,
              status: UserStatus.ACTIVE
            }
          });

          if (activeAdminCount <= 1) {
            throw new BusinessRuleError('Cannot remove the last active admin');
          }
        }
      }

      // Perform update via service
      const updatedUser = await userService.update(validatedId, {
        ...(updateData.role && { role: updateData.role }),
        ...(updateData.status && { status: updateData.status }),
        ...(updateData.permissions !== undefined && {
          permissions: updateData.permissions
        })
      });

      return apiResponse(updatedUser);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
