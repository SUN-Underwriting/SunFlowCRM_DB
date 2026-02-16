import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { StageService } from '@/lib/services/crm/stage-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { CommonSchemas } from '@/lib/api/validation';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new StageService(user.tenantId, user.id);
      const { id } = await context.params;
      const validatedId = CommonSchemas.id.parse(id);

      const stages = await service.listByPipeline(validatedId);
      return apiResponse(stages);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
