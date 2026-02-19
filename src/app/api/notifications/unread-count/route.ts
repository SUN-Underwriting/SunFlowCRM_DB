import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { getUnreadCount } from '@/server/notifications/service';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const count = await getUnreadCount(user.tenantId, user.id);
      return apiResponse({ count });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
