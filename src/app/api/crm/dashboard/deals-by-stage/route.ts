import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DashboardService } from '@/lib/services/crm/dashboard-service';
import { apiResponse, handleApiError } from '@/lib/api/response';

/**
 * GET /api/crm/dashboard/deals-by-stage
 * Returns deals distribution by stage
 * Context7: Use service layer for business logic
 */
export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DashboardService(user.tenantId, user.id);

      const dealsByStage = await service.getDealsByStage();

      return apiResponse(dealsByStage);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
