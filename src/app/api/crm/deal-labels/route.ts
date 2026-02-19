import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DealLabelService } from '@/lib/services/crm/deal-label-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DealLabelService(user.tenantId, user.id);
      const labels = await service.list();
      return apiResponse({ labels });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DealLabelService(user.tenantId, user.id);
      const body = await validateRequestBody(
        request,
        CommonSchemas.createDealLabel
      );
      const label = await service.create(body);
      return apiResponse(label, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
