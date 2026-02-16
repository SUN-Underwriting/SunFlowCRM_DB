import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { EmailService } from '@/lib/services/crm/email-service';
import { EmailDirection } from '@prisma/client';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new EmailService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const directionParam = searchParams.get('direction') || undefined;
      const direction =
        directionParam &&
        Object.values(EmailDirection).includes(directionParam as EmailDirection)
          ? (directionParam as EmailDirection)
          : undefined;
      const dealId = searchParams.get('dealId') || undefined;
      const personId = searchParams.get('personId') || undefined;
      const threadId = searchParams.get('threadId') || undefined;
      const search = searchParams.get('search') || undefined;
      const { skip, take } = parsePagination(searchParams);

      const result = await service.list({
        direction,
        dealId,
        personId,
        threadId,
        search,
        skip,
        take
      });

      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new EmailService(user.tenantId, user.id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.createEmail
      );
      const email = await service.create(body);

      return apiResponse(email, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
