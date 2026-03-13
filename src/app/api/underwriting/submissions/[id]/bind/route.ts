import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { bindSubmissionWorkflow } from '@/features/underwriting/server/workflow-service';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    return await withCurrentUser(request, async (user) => {
      const { id } = await context.params;

      const submission = await bindSubmissionWorkflow({
        tenantId: user.tenantId,
        submissionId: id,
        actorUserId: user.id
      });

      return apiResponse({ submission });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
