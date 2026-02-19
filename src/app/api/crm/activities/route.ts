import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { ActivityService } from '@/lib/services/crm/activity-service';
import { ActivityType } from '@prisma/client';
import { apiResponse, handleApiError } from '@/lib/api/response';
import {
  parsePagination,
  validateRequestBody,
  CommonSchemas
} from '@/lib/api/validation';
import type { ActivityFilters } from '@/lib/services/crm/activity-service';

const VALID_ACTIVITY_TYPES = Object.values(ActivityType);

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new ActivityService(user.tenantId, user.id);
      const { searchParams } = new URL(request.url);

      // Tab status
      const statusParam = searchParams.get('status');
      const status = (statusParam === 'todo' || statusParam === 'done' || statusParam === 'all')
        ? statusParam
        : undefined;

      // Type filter
      const typeParam = searchParams.get('type');
      const type = typeParam && VALID_ACTIVITY_TYPES.includes(typeParam as ActivityType)
        ? (typeParam as ActivityType)
        : undefined;

      // Owner filter
      const ownerParam = searchParams.get('owner');
      const ownerId = ownerParam === 'me'
        ? user.id
        : (ownerParam && ownerParam !== 'everyone')
          ? ownerParam
          : undefined;

      // Entity filters
      const dealId   = searchParams.get('dealId')   || undefined;
      const leadId   = searchParams.get('leadId')   || undefined;
      const personId = searchParams.get('personId') || undefined;
      const orgId    = searchParams.get('orgId')    || undefined;

      // Due date preset
      const dueParam = searchParams.get('due');
      const due = (dueParam === 'overdue' || dueParam === 'today' || dueParam === 'week' || dueParam === 'range')
        ? dueParam
        : undefined;
      const fromParam = searchParams.get('from');
      const toParam   = searchParams.get('to');
      const dueDateFrom = fromParam ? new Date(fromParam) : undefined;
      const dueDateTo   = toParam   ? new Date(toParam)   : undefined;

      // Search
      const q = searchParams.get('q') || undefined;

      // Sorting
      const sortByParam = searchParams.get('sortBy');
      const sortBy = (
        sortByParam === 'dueAt' ||
        sortByParam === 'createdAt' ||
        sortByParam === 'subject' ||
        sortByParam === 'type'
      ) ? sortByParam : undefined;
      const sortDesc = searchParams.get('sortDesc') === 'true';

      // Pagination
      const { skip, take } = parsePagination(searchParams);

      const filters: ActivityFilters = {
        status, type, ownerId,
        dealId, leadId, personId, orgId,
        due, dueDateFrom, dueDateTo,
        q, sortBy, sortDesc,
        skip, take
      };

      const result = await service.list(filters);
      return apiResponse(result);
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const service = new ActivityService(user.tenantId, user.id);
      const body = await validateRequestBody(request, CommonSchemas.createActivity);
      const activity = await service.create(body);
      return apiResponse(activity, 201);
    });
  } catch (error) {
    return handleApiError(error);
  }
}
