import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { ActivityService } from '@/lib/services/crm/activity-service';
import { ActivityType } from '@prisma/client';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new ActivityService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const typeParam = searchParams.get('type') || undefined;
      const type =
        typeParam &&
        Object.values(ActivityType).includes(typeParam as ActivityType)
          ? (typeParam as ActivityType)
          : undefined;
      const done =
        searchParams.get('done') === 'true'
          ? true
          : searchParams.get('done') === 'false'
            ? false
            : undefined;
      const ownerId = searchParams.get('ownerId') || undefined;
      const dealId = searchParams.get('dealId') || undefined;
      const personId = searchParams.get('personId') || undefined;
      const { skip, take } = parsePagination(searchParams);

      const result = await service.list({
        type,
        done,
        ownerId,
        dealId,
        personId,
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
      const service = new ActivityService(user.tenantId, user.id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.createActivity
      );
      const activity = await service.create(body);

      return apiResponse(activity, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
