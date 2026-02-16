import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { PersonService } from '@/lib/services/crm/person-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new PersonService(user.tenantId, user.id);

      const { searchParams } = new URL(request.url);
      const search = searchParams.get('search') || undefined;
      const orgId = searchParams.get('orgId') || undefined;
      const { skip, take } = parsePagination(searchParams);

      const result = await service.list({ search, orgId, skip, take });
      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new PersonService(user.tenantId, user.id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.createPerson
      );
      const person = await service.create(body);

      return apiResponse(person, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
