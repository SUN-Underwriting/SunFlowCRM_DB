import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DealService } from '@/lib/services/crm/deal-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { CommonSchemas } from '@/lib/api/validation';
import { z } from 'zod';

const markAsLostSchema = z.object({
  reason: z.string().max(500).optional()
});

/**
 * POST /api/crm/deals/[id]/lost
 * Mark deal as lost with optional reason
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

      // Parse body for optional reason
      const body = await request.json().catch(() => ({}));
      const { reason } = markAsLostSchema.parse(body);

      const deal = await service.markAsLost(validatedId, reason);
      return apiResponse(deal);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
