import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DealService } from '@/lib/services/crm/deal-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';
import { ValidationError } from '@/lib/errors/app-errors';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DealService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const deal = await service.getById(validatedId);
      return apiResponse(deal);
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
      const service = new DealService(user.tenantId, user.id);
      const { id } = await context.params;

      // Validate ID format
      const validatedId = CommonSchemas.id.parse(id);

      const body = await validateRequestBody(request, CommonSchemas.updateDeal);
      const deal = await service.update(validatedId, body);

      return apiResponse(deal);
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
      const service = new DealService(user.tenantId, user.id);
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
