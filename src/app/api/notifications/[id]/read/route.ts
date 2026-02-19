import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { markAsRead } from '@/server/notifications/service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const { id } = await context.params;
      await markAsRead(user.tenantId, user.id, id);
      return apiResponse({ success: true });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
