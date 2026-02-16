import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DashboardService } from '@/lib/services/crm/dashboard-service';
import { apiResponse, handleApiError } from '@/lib/api/response';

/**
 * GET /api/crm/dashboard/recent-activities
 * Returns recent activities for dashboard widget
 * Context7: Use service layer for business logic
 */
export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DashboardService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const limitRaw = searchParams.get('limit') || '5';
      const limit = Math.min(Math.max(parseInt(limitRaw, 10) || 5, 1), 100);

      const activities = await service.getRecentActivities(limit);

      return apiResponse(activities);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
