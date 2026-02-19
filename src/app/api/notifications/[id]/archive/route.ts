import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { archiveNotification } from '@/server/notifications/service';

/**
 * POST /api/notifications/:id/archive
 * Archive a single notification (removes from inbox, keeps in history).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const { id } = await params;
      await archiveNotification(user.tenantId, user.id, id);
      return apiResponse({ ok: true });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
