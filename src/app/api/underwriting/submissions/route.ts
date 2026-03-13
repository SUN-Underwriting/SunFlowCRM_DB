import { NextRequest } from 'next/server';
import { withCurrentUser } from '@/lib/auth/get-current-user';
import { apiResponse, handleApiError } from '@/lib/api/response';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    return await withCurrentUser(request, async (user) => {
      const submissions = await prisma.submission.findMany({
        where: { tenantId: user.tenantId, deleted: false },
        orderBy: { createdAt: 'desc' },
        include: {
          quotes: {
            orderBy: { createdAt: 'desc' },
            take: 1
          }
        }
      });

      return apiResponse({ submissions });
    });
  } catch (error) {
    return handleApiError(error);
  }
}
