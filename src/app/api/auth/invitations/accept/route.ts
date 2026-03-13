import { NextRequest } from 'next/server';
import { z } from 'zod';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { ValidationError } from '@/lib/errors/app-errors';
import { UserInviteService } from '@/lib/services/user-invite-service';

const schema = z.object({
  token: z.string().min(1, 'Token is required')
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(
        'Validation failed',
        parsed.error.flatten().fieldErrors
      );
    }

    const accepted = await UserInviteService.acceptByToken(parsed.data.token);

    return apiResponse({
      accepted: true,
      user: accepted.user,
      tenant: accepted.tenant
    });
  } catch (error) {
    return handleApiError(error);
  }
}
