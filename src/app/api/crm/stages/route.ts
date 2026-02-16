import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { StageService } from '@/lib/services/crm/stage-service';
import { apiResponse, apiError, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new StageService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const pipelineId = searchParams.get('pipelineId');

      if (!pipelineId) {
        return apiError('pipelineId query parameter is required', 400);
      }

      // Context7: Validate query param ID format before passing to service
      const validatedPipelineId = CommonSchemas.id.parse(pipelineId);

      const stages = await service.listByPipeline(validatedPipelineId);
      return apiResponse({ stages });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new StageService(user.tenantId, user.id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.createStage
      );
      const stage = await service.create(body);

      return apiResponse(stage, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
