import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { FieldDefinitionService } from '@/lib/services/crm/field-definition-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new FieldDefinitionService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const field = await service.getById(validatedId);
      return apiResponse(field);
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
      const service = new FieldDefinitionService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.updateFieldDefinition
      );
      const field = await service.update(validatedId, body);

      return apiResponse(field);
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
      const service = new FieldDefinitionService(user.tenantId, user.id);
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
