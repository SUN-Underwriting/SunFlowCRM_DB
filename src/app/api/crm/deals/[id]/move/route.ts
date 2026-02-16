import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DealService } from '@/lib/services/crm/deal-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DealService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const { stageId } = await validateRequestBody(
        request,
        CommonSchemas.moveDeal
      );

      const deal = await service.moveToStage(validatedId, stageId);
      return apiResponse(deal);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
