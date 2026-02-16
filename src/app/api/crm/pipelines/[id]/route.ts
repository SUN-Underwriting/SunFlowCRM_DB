import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { PipelineService } from '@/lib/services/crm/pipeline-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new PipelineService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const pipeline = await service.getById(validatedId);
      return apiResponse(pipeline);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new PipelineService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.updatePipeline
      );
      const pipeline = await service.update(validatedId, body);

      return apiResponse(pipeline);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new PipelineService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const result = await service.delete(validatedId);
      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
