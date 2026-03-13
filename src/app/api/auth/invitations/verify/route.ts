import { NextRequest } from 'next/server';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { UserInviteService } from '@/lib/services/user-invite-service';

export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token') ?? '';
    const invite = await UserInviteService.verifyByToken(token);

    return apiResponse({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.user.role,
        tenantName: invite.tenant.name,
        firstName: invite.user.firstName,
        lastName: invite.user.lastName,
        expiresAt: invite.expiresAt
      }
    });
  } catch (error) {
    return handleApiError(error);
  }
}
