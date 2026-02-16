import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DashboardService } from '@/lib/services/crm/dashboard-service';
import { apiResponse, handleApiError } from '@/lib/api/response';

/**
 * GET /api/crm/dashboard/kpis
 * Returns KPI metrics for dashboard
 * Context7: Use service layer for business logic
 */
export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DashboardService(user.tenantId, user.id);

      const kpis = await service.getKPIs();

      return apiResponse(kpis);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
