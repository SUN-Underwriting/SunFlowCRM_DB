import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { NoteService } from '@/lib/services/crm/note-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new NoteService(user.tenantId, user.id);
      const { id: leadId } = await context.params;
      const validatedId = CommonSchemas.id.parse(leadId);

      const { searchParams } = new URL(request.url);
      const pinnedParam = searchParams.get('pinned');
      const pinned = pinnedParam !== null ? pinnedParam === 'true' : undefined;
      const { skip, take } = parsePagination(searchParams);

      const result = await service.list({
        leadId: validatedId,
        pinned,
        skip,
        take
      });

      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new NoteService(user.tenantId, user.id);
      const { id: leadId } = await context.params;
      const validatedId = CommonSchemas.id.parse(leadId);

      const body = await validateRequestBody(request, CommonSchemas.createNote);
      const note = await service.create({
        ...body,
        leadId: validatedId
      });

      return apiResponse(note, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
