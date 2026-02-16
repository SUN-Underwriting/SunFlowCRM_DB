import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { LeadService } from '@/lib/services/crm/lead-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new LeadService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.convertLead
      );
      const result = await service.convertToDeal(validatedId, body);

      return apiResponse(result, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
