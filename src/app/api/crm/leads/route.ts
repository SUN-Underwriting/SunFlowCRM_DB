import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { LeadService } from '@/lib/services/crm/lead-service';
import { LeadStatus } from '@prisma/client';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new LeadService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const statusParam = searchParams.get('status') || undefined;
      const status =
        statusParam &&
        Object.values(LeadStatus).includes(statusParam as LeadStatus)
          ? (statusParam as LeadStatus)
          : undefined;
      const source = searchParams.get('source') || undefined;
      const ownerId = searchParams.get('ownerId') || undefined;
      const search = searchParams.get('search') || undefined;
      const wasSeenParam = searchParams.get('wasSeen');
      const wasSeen =
        wasSeenParam !== null ? wasSeenParam === 'true' : undefined;
      const { skip, take } = parsePagination(searchParams);

      const result = await service.list({
        status,
        source,
        ownerId,
        search,
        wasSeen,
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
      const service = new LeadService(user.tenantId, user.id);

      const body = await validateRequestBody(request, CommonSchemas.createLead);
      const lead = await service.create(body);

      return apiResponse(lead, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
