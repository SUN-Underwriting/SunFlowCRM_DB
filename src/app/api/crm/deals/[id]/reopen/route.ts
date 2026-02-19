import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DealService } from '@/lib/services/crm/deal-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { CommonSchemas } from '@/lib/api/validation';

/**
 * POST /api/crm/deals/[id]/reopen
 * Reopen a closed deal (WON or LOST back to OPEN)
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DealService(user.tenantId, user.id);
      const { id } = await context.params;
      const validatedId = CommonSchemas.id.parse(id);

      const deal = await service.reopen(validatedId);
      return apiResponse(deal);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
