import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { markAllAsRead } from '@/server/notifications/service';

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      await markAllAsRead(user.tenantId, user.id);
      return apiResponse({ success: true });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
