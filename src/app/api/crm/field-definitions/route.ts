import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { FieldDefinitionService } from '@/lib/services/crm/field-definition-service';
import { FieldEntityType } from '@prisma/client';
import { apiResponse, apiError, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new FieldDefinitionService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const entityTypeParam = searchParams.get('entityType');

      if (!entityTypeParam) {
        return apiError('entityType query parameter is required', 400);
      }

      if (
        !Object.values(FieldEntityType).includes(
          entityTypeParam as FieldEntityType
        )
      ) {
        return apiError(
          `Invalid entityType: must be one of ${Object.values(FieldEntityType).join(', ')}`,
          400
        );
      }

      const fields = await service.listByEntityType(
        entityTypeParam as FieldEntityType
      );
      // Context7: Return wrapped response to match client contract
      return apiResponse({ fieldDefinitions: fields });
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new FieldDefinitionService(user.tenantId, user.id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.createFieldDefinition
      );
      const field = await service.create(body);

      return apiResponse(field, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
