import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { PipelineService } from '@/lib/services/crm/pipeline-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new PipelineService(user.tenantId, user.id);

      const pipelines = await service.list();
      return apiResponse({ pipelines });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new PipelineService(user.tenantId, user.id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.createPipeline
      );
      const pipeline = await service.create(body);

      return apiResponse(pipeline, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
