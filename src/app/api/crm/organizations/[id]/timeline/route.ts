import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { TimelineService, TimelineItemType } from '@/lib/services/crm/timeline-service';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { parsePagination, CommonSchemas } from '@/lib/api/validation';

const VALID_TYPES: TimelineItemType[] = ['activity', 'note', 'email'];

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new TimelineService(user.tenantId, user.id);
      const { id: orgId } = await context.params;
      const validatedId = CommonSchemas.id.parse(orgId);

      const { searchParams } = new URL(request.url);
      const typesParam = searchParams.get('types');
      const types = typesParam
        ? (typesParam
            .split(',')
            .filter((t) => VALID_TYPES.includes(t as TimelineItemType)) as TimelineItemType[])
        : undefined;
      const { skip, take } = parsePagination(searchParams);

      const result = await service.getOrganizationTimeline({
        orgId: validatedId,
        types,
        skip,
        take
      });

      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
