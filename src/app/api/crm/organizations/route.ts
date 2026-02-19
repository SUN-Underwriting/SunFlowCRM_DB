import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { OrganizationService } from '@/lib/services/crm/organization-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new OrganizationService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search') || undefined;
      const domain = searchParams.get('domain') || undefined;
      const ownerId = searchParams.get('ownerId') || undefined;
      const countryCode = searchParams.get('countryCode') || undefined;
      const city = searchParams.get('city') || undefined;
      const industry = searchParams.get('industry') || undefined;
      const size = searchParams.get('size') || undefined;
      const sortBy = searchParams.get('sortBy') || undefined;
      const sortDesc = searchParams.get('sortDesc') === 'true';
      const { skip, take } = parsePagination(searchParams);

      const result = await service.list({
        search,
        domain,
        ownerId,
        countryCode,
        city,
        industry,
        size,
        sortBy,
        sortDesc,
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
      const service = new OrganizationService(user.tenantId, user.id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.createOrganization
      );
      const organization = await service.create(body);

      return apiResponse(organization, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
