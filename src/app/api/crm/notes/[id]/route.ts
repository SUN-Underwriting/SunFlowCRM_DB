import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { NoteService } from '@/lib/services/crm/note-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { validateRequestBody, CommonSchemas } from '@/lib/api/validation';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new NoteService(user.tenantId, user.id);
      const { id } = await context.params;
      const validatedId = CommonSchemas.id.parse(id);

      const body = await validateRequestBody(
        request,
        CommonSchemas.updateNote
      );
      const note = await service.update(validatedId, body);
      return apiResponse(note);
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
      const service = new NoteService(user.tenantId, user.id);
      const { id } = await context.params;
      const validatedId = CommonSchemas.id.parse(id);

      const result = await service.delete(validatedId);
      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
