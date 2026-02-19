import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { CommonSchemas } from '@/lib/api/validation';
import { listNotifications } from '@/server/notifications/service';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const { searchParams } = new URL(request.url);

      const query = CommonSchemas.listNotificationsQuery.parse({
        cursor: searchParams.get('cursor') ?? undefined,
        limit: searchParams.get('limit') ?? undefined,
        unreadOnly: searchParams.get('unreadOnly') ?? undefined,
      });

      const typesParam = searchParams.get('types');
      const types = typesParam ? typesParam.split(',').filter(Boolean) : undefined;

      const result = await listNotifications(user.tenantId, user.id, { ...query, types });

      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
