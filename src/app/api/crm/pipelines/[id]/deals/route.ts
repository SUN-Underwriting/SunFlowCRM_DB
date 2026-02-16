import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { PipelineService } from '@/lib/services/crm/pipeline-service';
import { DealService } from '@/lib/services/crm/deal-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { CommonSchemas } from '@/lib/api/validation';

/**
 * GET /api/crm/pipelines/:id/deals
 * Get all deals for a specific pipeline, grouped by stages
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const pipelineService = new PipelineService(user.tenantId, user.id);
      const dealService = new DealService(user.tenantId, user.id);

      const { id: pipelineId } = await context.params;
      const validatedPipelineId = CommonSchemas.id.parse(pipelineId);

      // Get pipeline with stages
      const pipeline = await pipelineService.getById(validatedPipelineId);

      if (!pipeline) {
        return handleApiError(new Error('Pipeline not found'));
      }

      // Get all deals for this pipeline
      const { deals } = await dealService.list({
        pipelineId: validatedPipelineId,
        take: 1000 // Get all deals for kanban board
      });

      return apiResponse({
        pipeline,
        stages: pipeline.stages || [],
        deals
      });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
