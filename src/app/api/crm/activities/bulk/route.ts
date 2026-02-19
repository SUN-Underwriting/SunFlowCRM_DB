import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { ActivityService } from '@/lib/services/crm/activity-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new ActivityService(user.tenantId, user.id);
      const body = await validateRequestBody(request, CommonSchemas.bulkActivity);
      const result = await service.bulk(body);
      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
