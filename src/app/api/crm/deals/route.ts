import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { DealService } from '@/lib/services/crm/deal-service';
import { DealStatus } from '@prisma/client';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DealService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const pipelineId = searchParams.get('pipelineId') || undefined;
      const stageId = searchParams.get('stageId') || undefined;
      const ownerId = searchParams.get('ownerId') || undefined;
      const statusParam = searchParams.get('status') || undefined;
      const status =
        statusParam &&
        Object.values(DealStatus).includes(statusParam as DealStatus)
          ? (statusParam as DealStatus)
          : undefined;
      const search = searchParams.get('search') || undefined;
      const { skip, take } = parsePagination(searchParams);

      const result = await service.list({
        pipelineId,
        stageId,
        ownerId,
        status,
        search,
        skip,
        take
      });

      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new DealService(user.tenantId, user.id);

      const body = await validateRequestBody(request, CommonSchemas.createDeal);
      const deal = await service.create(body);

      return apiResponse(deal, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
